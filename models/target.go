package models

import (
	"errors"
	"time"

	log "github.com/niklasent/gophishusb/logger"
)

// Target contains the fields needed for individual targets specified by the user
// Groups contain 1..* Targets
type Target struct {
	Id             int64     `json:"id"`
	GroupId        int64     `json:"group_id"`
	ApiKey         string    `json:"api_key"`
	RegisteredDate time.Time `json:"registered_date"`
	LastSeen       time.Time `json:"last_seen"`
	BaseRecipient
}

// BaseRecipient contains the fields for a single recipient. This is the base
// struct used in members of groups and campaign results.
type BaseRecipient struct {
	Hostname string `json:"hostname"`
	OS       string `json:"os"`
}

// ErrHostnameNotSpecified is thrown when no hostname is specified
var ErrHostnameNotSpecified = errors.New("no hostname specified")

// ErrUserTargetMismatch is thrown when a user is not permitted for a target
var ErrUserTargetMismatch = errors.New("user not permitted for target")

// Validate performs validation on a group given by the user
func (t *Target) Validate() error {
	if t.Hostname == "" {
		return ErrHostnameNotSpecified
	}
	return nil
}

// GetTargets performs a one-to-many select to get all the Targets for a Group
func GetTargets(gid int64) ([]Target, error) {
	ts := []Target{}
	err := db.Table("targets").Select("targets.id, targets.registered_date, targets.last_seen, targets.hostname, targets.os").Where("group_id=?", gid).Scan(&ts).Error
	return ts, err
}

// GetTarget returns a target by the specified target ID and user ID
func GetTarget(id int64, uid int64) (Target, error) {
	t := Target{}
	err := db.Where("id=?", id).Find(&t).Error
	if err != nil {
		log.Error(err)
		return t, err
	}
	// Targets do not contain group information so we have to look up each group for the user
	gs, err := GetGroups(uid)
	if err != nil {
		log.Error(err)
		return Target{}, err
	}
	for _, g := range gs {
		for _, gt := range g.Targets {
			if gt.Id == id {
				return t, err
			}
		}
	}

	err = ErrUserTargetMismatch
	return Target{}, err
}

// GetTargetByKey returns a target by its API key
func GetTargetByAPIKey(key string) (Target, error) {
	t := Target{}
	err := db.Where("api_key=?", key).Find(&t).Error
	return t, err
}

// PostTarget inserts target to database
func PostTarget(t *Target) error {
	t.RegisteredDate = time.Now().UTC()
	err := t.Validate()
	if err != nil {
		return err
	}
	tx := db.Begin()
	err = tx.Save(t).Error
	if err != nil {
		tx.Rollback()
		log.Error(err)
		return err
	}
	err = tx.Commit().Error
	if err != nil {
		log.Error(err)
		tx.Rollback()
		return err
	}
	return nil
}

// DeleteTarget deletes a target from the database
func DeleteTarget(t *Target) error {
	err := db.Delete(t).Error
	if err != nil {
		log.Error(err)
		return err
	}
	return err
}

// PingTarget updates the last seen date for a given target
func PingTarget(t *Target) error {
	t.LastSeen = time.Now().UTC()
	err := t.Validate()
	if err != nil {
		return err
	}
	tx := db.Begin()
	err = tx.Save(t).Error
	if err != nil {
		tx.Rollback()
		log.Error(err)
		return err
	}
	err = tx.Commit().Error
	if err != nil {
		log.Error(err)
		tx.Rollback()
		return err
	}
	return nil
}
