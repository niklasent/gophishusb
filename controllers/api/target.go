package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"github.com/niklasent/gophishusb/auth"
	ctx "github.com/niklasent/gophishusb/context"
	log "github.com/niklasent/gophishusb/logger"
	"github.com/niklasent/gophishusb/models"
)

// Targets returns a list of targets if requested via GET.
// If requested via POST, APITargets creates a new target and returns a reference to it.
func (as *Server) Targets(w http.ResponseWriter, r *http.Request) {
	switch {
	case r.Method == "GET":
		vars := mux.Vars(r)
		id, _ := strconv.ParseInt(vars["id"], 0, 64)
		g, err := models.GetGroup(id, ctx.Get(r, "user_id").(int64))
		if err != nil {
			JSONResponse(w, models.Response{Success: false, Message: "Group not found"}, http.StatusNotFound)
			return
		}
		ts, err := models.GetTargets(g.Id)
		if err != nil {
			JSONResponse(w, models.Response{Success: false, Message: "Targets not found"}, http.StatusNotFound)
			return
		}
		JSONResponse(w, ts, http.StatusOK)
	//POST: Register a new target and return it with key
	case r.Method == "POST":
		t := models.Target{}
		// Put the request into a target
		err := json.NewDecoder(r.Body).Decode(&t)
		if err != nil {
			JSONResponse(w, models.Response{Success: false, Message: "Invalid JSON structure"}, http.StatusBadRequest)
			return
		}
		_, err = models.GetGroup(t.GroupId, ctx.Get(r, "user_id").(int64))
		if err != nil {
			JSONResponse(w, models.Response{Success: false, Message: "Group not found"}, http.StatusNotFound)
			return
		}
		t.ApiKey = auth.GenerateSecureKey(auth.APIKeyLength)
		t.LastSeen = time.Now().UTC()
		err = models.PostTarget(&t)
		if err != nil {
			JSONResponse(w, models.Response{Success: false, Message: err.Error()}, http.StatusBadRequest)
			return
		}
		JSONResponse(w, t, http.StatusCreated)
	}
}

// Target returns details about the requested target.
// If the group is not valid, Target returns null.
func (as *Server) Target(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.ParseInt(vars["id"], 0, 64)
	t, err := models.GetTarget(id, ctx.Get(r, "user_id").(int64))
	switch {
	case r.Method == "GET":
		if err != nil {
			log.Error(err)
			JSONResponse(w, models.Response{Success: false, Message: "Target not found"}, http.StatusNotFound)
			return
		}
		JSONResponse(w, t, http.StatusOK)
	case r.Method == "DELETE":
		err := models.DeleteTarget(&t)
		if err != nil {
			JSONResponse(w, models.Response{Success: false, Message: "Error deleting target"}, http.StatusInternalServerError)
			return
		}
		JSONResponse(w, models.Response{Success: true, Message: "Target deleted successfully!"}, http.StatusOK)
	}
}
