package controllers

import (
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/NYTimes/gziphandler"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/jordan-wright/unindexed"
	"github.com/niklasent/gophishusb/config"
	ctx "github.com/niklasent/gophishusb/context"
	"github.com/niklasent/gophishusb/controllers/api"
	log "github.com/niklasent/gophishusb/logger"
	mid "github.com/niklasent/gophishusb/middleware"
	"github.com/niklasent/gophishusb/models"
	"github.com/niklasent/gophishusb/util"
)

// ErrInvalidRequest is thrown when a request with an invalid structure is
// received
var ErrInvalidRequest = errors.New("invalid request")

// ErrCampaignComplete is thrown when an event is received for a campaign that
// has already been marked as complete.
var ErrCampaignComplete = errors.New("event received on completed campaign")

// TransparencyResponse is the JSON response provided when a third-party
// makes a request to the transparency handler.
type TransparencyResponse struct {
	Server         string `json:"server"`
	ContactAddress string `json:"contact_address"`
}

// TransparencySuffix (when appended to a valid result ID), will cause Gophish
// to return a transparency response.
const TransparencySuffix = "+"

// PhishingServerOption is a functional option that is used to configure the
// the phishing server
type PhishingServerOption func(*PhishingServer)

// PhishingServer is an HTTP server that implements the campaign event
// handlers, such as USB mounting, macro opening and more.
type PhishingServer struct {
	server         *http.Server
	config         config.PhishServer
	contactAddress string
}

// NewPhishingServer returns a new instance of the phishing server with
// provided options applied.
func NewPhishingServer(config config.PhishServer, options ...PhishingServerOption) *PhishingServer {
	defaultServer := &http.Server{
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		Addr:         config.ListenURL,
	}
	ps := &PhishingServer{
		server: defaultServer,
		config: config,
	}
	for _, opt := range options {
		opt(ps)
	}
	ps.registerRoutes()
	return ps
}

// WithContactAddress sets the contact address used by the transparency
// handlers
func WithContactAddress(addr string) PhishingServerOption {
	return func(ps *PhishingServer) {
		ps.contactAddress = addr
	}
}

// Start launches the phishing server, listening on the configured address.
func (ps *PhishingServer) Start() {
	if ps.config.UseTLS {
		// Only support TLS 1.2 and above - ref #1691, #1689
		ps.server.TLSConfig = defaultTLSConfig
		err := util.CheckAndCreateSSL(ps.config.CertPath, ps.config.KeyPath)
		if err != nil {
			log.Fatal(err)
		}
		log.Infof("Starting phishing server at https://%s", ps.config.ListenURL)
		log.Fatal(ps.server.ListenAndServeTLS(ps.config.CertPath, ps.config.KeyPath))
	}
	// If TLS isn't configured, just listen on HTTP
	log.Infof("Starting phishing server at http://%s", ps.config.ListenURL)
	log.Fatal(ps.server.ListenAndServe())
}

// Shutdown attempts to gracefully shutdown the server.
func (ps *PhishingServer) Shutdown() error {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*10)
	defer cancel()
	return ps.server.Shutdown(ctx)
}

// CreatePhishingRouter creates the router that handles phishing connections.
func (ps *PhishingServer) registerRoutes() {
	router := mux.NewRouter()
	fileServer := http.FileServer(unindexed.Dir("./static/endpoint/"))
	router.PathPrefix("/static/").Handler(http.StripPrefix("/static/", fileServer))
	router.HandleFunc("/robots.txt", ps.RobotsHandler)
	phishRouter := router.PathPrefix("/phish/").Subrouter()
	phishRouter.Use(mid.RequireTargetAPIKey)
	phishRouter.HandleFunc("/ping/", ps.TargetPingHandler)
	phishRouter.HandleFunc("/mount/", ps.PhishMountHandler)
	phishRouter.HandleFunc("/macro/", ps.PhishMacroHandler)
	phishRouter.HandleFunc("/exec/", ps.PhishExecHandler)

	// Setup GZIP compression
	gzipWrapper, _ := gziphandler.NewGzipLevelHandler(gzip.BestCompression)
	phishHandler := gzipWrapper(router)

	// Respect X-Forwarded-For and X-Real-IP headers in case we're behind a
	// reverse proxy.
	phishHandler = handlers.ProxyHeaders(phishHandler)

	// Setup logging
	phishHandler = handlers.CombinedLoggingHandler(log.Writer(), phishHandler)
	ps.server.Handler = phishHandler
}

// TargetPingHandler handles incoming pings from target
func (ps *PhishingServer) TargetPingHandler(w http.ResponseWriter, r *http.Request) {
	t := ctx.Get(r, "target").(models.Target)
	err := models.PingTarget(&t)
	if err != nil {
		log.Error(err)
		api.JSONResponse(w, models.Response{Success: false, Message: err.Error()}, http.StatusInternalServerError)
		return
	}
	api.JSONResponse(w, models.Response{Success: true, Message: "Event OK"}, http.StatusOK)
}

// PhishHandler handles incoming client connections and registers the USB mount action
func (ps *PhishingServer) PhishMountHandler(w http.ResponseWriter, r *http.Request) {
	// Get event details from agent
	d := models.EventDetails{}
	err := json.NewDecoder(r.Body).Decode(&d)
	if err != nil {
		log.Errorf("error decoding event details: %v", err)
		api.JSONResponse(w, models.Response{Success: false, Message: err.Error()}, http.StatusInternalServerError)
		return
	}
	tid := ctx.Get(r, "target_id").(int64)
	t := ctx.Get(r, "target").(models.Target)
	usbcheck, err := models.CheckUsb(d.USB, tid)
	if (err != nil) || (!usbcheck) {
		api.JSONResponse(w, models.Response{Success: false, Message: err.Error()}, http.StatusForbidden)
		return
	}
	rs, err := models.GetActiveResultsByTargetId(tid)
	if err != nil {
		log.Error(err)
		http.NotFound(w, r)
		return
	}
	for _, r := range rs {
		err = r.HandleMounted(t.Hostname, d)
		if err != nil {
			log.Error(err)
		}
	}
	api.JSONResponse(w, models.Response{Success: true, Message: "Event OK"}, http.StatusOK)
}

// PhishMacroHandler handles incoming client connections and registers the macro opening action
func (ps *PhishingServer) PhishMacroHandler(w http.ResponseWriter, r *http.Request) {
	// Get event details from agent
	d := models.EventDetails{}
	err := json.NewDecoder(r.Body).Decode(&d)
	if err != nil {
		log.Errorf("error decoding event details: %v", err)
		api.JSONResponse(w, models.Response{Success: false, Message: err.Error()}, http.StatusInternalServerError)
		return
	}
	tid := ctx.Get(r, "target_id").(int64)
	t := ctx.Get(r, "target").(models.Target)
	usbcheck, err := models.CheckUsb(d.USB, tid)
	if (err != nil) || (!usbcheck) {
		api.JSONResponse(w, models.Response{Success: false, Message: err.Error()}, http.StatusForbidden)
		return
	}
	rs, err := models.GetActiveResultsByTargetId(tid)
	if err != nil {
		log.Error(err)
		http.NotFound(w, r)
		return
	}
	for _, r := range rs {
		err = r.HandleOpenedMacro(t.Hostname, d)
		if err != nil {
			log.Error(err)
		}
	}
	api.JSONResponse(w, models.Response{Success: true, Message: "Event OK"}, http.StatusOK)
}

// PhishExecHandler handles incoming client connections and registers the executable opening action
func (ps *PhishingServer) PhishExecHandler(w http.ResponseWriter, r *http.Request) {
	// Get event details from agent
	d := models.EventDetails{}
	err := json.NewDecoder(r.Body).Decode(&d)
	if err != nil {
		log.Errorf("error decoding event details: %v", err)
		api.JSONResponse(w, models.Response{Success: false, Message: err.Error()}, http.StatusInternalServerError)
		return
	}
	tid := ctx.Get(r, "target_id").(int64)
	t := ctx.Get(r, "target").(models.Target)
	usbcheck, err := models.CheckUsb(d.USB, tid)
	if (err != nil) || (!usbcheck) {
		api.JSONResponse(w, models.Response{Success: false, Message: err.Error()}, http.StatusForbidden)
		return
	}
	rs, err := models.GetActiveResultsByTargetId(tid)
	if err != nil {
		log.Error(err)
		http.NotFound(w, r)
		return
	}
	for _, r := range rs {
		err = r.HandleOpenedExec(t.Hostname, d)
		if err != nil {
			log.Error(err)
		}
	}
	api.JSONResponse(w, models.Response{Success: true, Message: "Event OK"}, http.StatusOK)
}

// RobotsHandler prevents search engines, etc. from indexing phishing materials
func (ps *PhishingServer) RobotsHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, "User-agent: *\nDisallow: /")
}

// TransparencyHandler returns a TransparencyResponse for the provided result
// and campaign.
func (ps *PhishingServer) TransparencyHandler(w http.ResponseWriter, r *http.Request) {
	tr := &TransparencyResponse{
		Server:         config.ServerName,
		ContactAddress: ps.contactAddress,
	}
	api.JSONResponse(w, tr, http.StatusOK)
}
