package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	ctx "github.com/niklasent/gophishusb/context"
	log "github.com/niklasent/gophishusb/logger"
	"github.com/niklasent/gophishusb/models"
)

// Usbs returns a list of USBs if requested via GET.
// If requested via POST, USBs registeres a new USB and returns a reference to it.
func (as *Server) Usbs(w http.ResponseWriter, r *http.Request) {
	switch {
	case r.Method == "GET":
		us, err := models.GetUsbs(ctx.Get(r, "user_id").(int64))
		if err != nil {
			log.Error(err)
		}
		JSONResponse(w, us, http.StatusOK)
	case r.Method == "POST":
		u := models.Usb{}
		// Put the request into a campaign
		err := json.NewDecoder(r.Body).Decode(&u)
		if err != nil {
			JSONResponse(w, models.Response{Success: false, Message: "Invalid JSON structure"}, http.StatusBadRequest)
			return
		}
		u.UserId = ctx.Get(r, "user_id").(int64)
		err = models.PostUsb(&u)
		if err != nil {
			JSONResponse(w, models.Response{Success: false, Message: err.Error()}, http.StatusBadRequest)
			return
		}
		JSONResponse(w, u, http.StatusCreated)
	}
}

// Usb returns details about the requested USB.
// If the USB is not valid, Group returns null.
func (as *Server) Usb(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.ParseInt(vars["id"], 0, 64)
	u, err := models.GetUsb(id, ctx.Get(r, "user_id").(int64))
	if err != nil {
		JSONResponse(w, models.Response{Success: false, Message: "USB not found"}, http.StatusNotFound)
		return
	}
	switch {
	case r.Method == "GET":
		JSONResponse(w, u, http.StatusOK)
	case r.Method == "DELETE":
		err = models.DeleteUsb(&u)
		if err != nil {
			JSONResponse(w, models.Response{Success: false, Message: "Error deleting USB"}, http.StatusInternalServerError)
			return
		}
		JSONResponse(w, models.Response{Success: true, Message: "USB deleted successfully!"}, http.StatusOK)
	}
}
