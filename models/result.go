package models

import (
	"encoding/json"
	"net"
	"time"

	log "github.com/niklasent/gophishusb/logger"
	"github.com/oschwald/maxminddb-golang"
)

type mmCity struct {
	GeoPoint mmGeoPoint `maxminddb:"location"`
}

type mmGeoPoint struct {
	Latitude  float64 `maxminddb:"latitude"`
	Longitude float64 `maxminddb:"longitude"`
}

// Result contains the fields for a result object,
// which is a representation of a target in a campaign.
type Result struct {
	Id           int64     `json:"-"`
	CampaignId   int64     `json:"-"`
	UserId       int64     `json:"-"`
	TargetID     int64     `json:"target_id"`
	Status       string    `json:"status" sql:"not null"`
	IP           string    `json:"ip"`
	Latitude     float64   `json:"latitude"`
	Longitude    float64   `json:"longitude"`
	ModifiedDate time.Time `json:"modified_date"`
	BaseRecipient
}

func (r *Result) createEvent(hostname string, status string, details interface{}) (*Event, error) {
	e := &Event{Hostname: hostname, Message: status}
	if details != nil {
		dj, err := json.Marshal(details)
		if err != nil {
			return nil, err
		}
		e.Details = string(dj)
	}
	AddEvent(e, r.CampaignId)
	return e, nil
}

// HandleMounted updates a Result in the case where the recipient mounted a USB.
func (r *Result) HandleMounted(hostname string, details EventDetails) error {
	// Don't create an event of the user already mounted a USB
	if r.Status == EventMounted || r.Status == EventOpenedMacro || r.Status == EventOpenedExec || r.Status == EventOpenedAll {
		return nil
	}
	event, err := r.createEvent(hostname, EventMounted, details)
	if err != nil {
		return err
	}
	// Don't update the status if the user already opened a file
	if r.Status == EventOpenedMacro || r.Status == EventOpenedExec || r.Status == EventOpenedAll {
		return nil
	}
	r.Status = EventMounted
	r.ModifiedDate = event.Time
	return db.Save(r).Error
}

// HandleOpenedMacro updates a Result in the case where the recipient opened the macro.
func (r *Result) HandleOpenedMacro(hostname string, details EventDetails) error {
	event, err := r.createEvent(hostname, EventOpenedMacro, details)
	if err != nil {
		return err
	}
	// Don't update the status if the user has already opened the macro.
	if r.Status == EventOpenedMacro || r.Status == EventOpenedAll {
		return nil
	}
	// Update the status to OpenedAll if the user has already opened the executable.
	if r.Status == EventOpenedExec {
		r.Status = EventOpenedAll
	} else {
		r.Status = EventOpenedMacro
	}
	r.ModifiedDate = event.Time
	return db.Save(r).Error
}

// HandleOpenedExec updates a Result in the case where the recipient opened the executable.
func (r *Result) HandleOpenedExec(hostname string, details EventDetails) error {
	event, err := r.createEvent(hostname, EventOpenedExec, details)
	if err != nil {
		return err
	}
	// Don't update the status if the user has already opened the executable.
	if r.Status == EventOpenedExec || r.Status == EventOpenedAll {
		return nil
	}
	// Update the status to OpenedAll if the user has already opened the macro.
	if r.Status == EventOpenedMacro {
		r.Status = EventOpenedAll
	} else {
		r.Status = EventOpenedExec
	}
	r.ModifiedDate = event.Time
	return db.Save(r).Error
}

// UpdateGeo updates the latitude and longitude of the result in
// the database given an IP address
func (r *Result) UpdateGeo(addr string) error {
	// Open a connection to the maxmind db
	mmdb, err := maxminddb.Open("static/db/geolite2-city.mmdb")
	if err != nil {
		log.Fatal(err)
	}
	defer mmdb.Close()
	ip := net.ParseIP(addr)
	var city mmCity
	// Get the record
	err = mmdb.Lookup(ip, &city)
	if err != nil {
		return err
	}
	// Update the database with the record information
	r.IP = addr
	r.Latitude = city.GeoPoint.Latitude
	r.Longitude = city.GeoPoint.Longitude
	return db.Save(r).Error
}

// GetResult returns the Result object from the database
// given the ResultId
func GetResult(rid string) (Result, error) {
	r := Result{}
	err := db.Where("r_id=?", rid).First(&r).Error
	return r, err
}

// GetActiveResultsByTargetId returns all results from active campaign for a given target
func GetActiveResultsByTargetId(tid int64) ([]Result, error) {
	// Get every result for target
	rs := []Result{}
	err := db.Where("target_id = ?", tid).Find(&rs).Error
	if err != nil {
		log.Error(err)
		return rs, err
	}
	// Dismiss all results from inactive campaigns
	ars := []Result{}
	for _, r := range rs {
		c := Campaign{}
		err = db.Where("id = ?", r.CampaignId).Find(&c).Error
		if err != nil {
			log.Error(err)
			continue
		}
		if c.Status == CampaignInProgress {
			ars = append(ars, r)
		}
	}
	return ars, err
}
