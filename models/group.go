package models

import (
	"errors"
	"time"

	log "github.com/niklasent/gophishusb/logger"
)

// Group contains the fields needed for a user -> group mapping
// Groups contain 1..* Targets
type Group struct {
	Id           int64     `json:"id"`
	UserId       int64     `json:"-"`
	Name         string    `json:"name"`
	CreatedDate  time.Time `json:"created_date"`
	ModifiedDate time.Time `json:"modified_date"`
	Targets      []Target  `json:"targets" sql:"-"`
}

// GroupSummaries is a struct representing the overview of Groups.
type GroupSummaries struct {
	Total  int64          `json:"total"`
	Groups []GroupSummary `json:"groups"`
}

// GroupSummary represents a summary of the Group model. The only
// difference is that, instead of listing the Targets (which could be expensive
// for large groups), it lists the target count.
type GroupSummary struct {
	Id           int64     `json:"id"`
	Name         string    `json:"name"`
	ModifiedDate time.Time `json:"modified_date"`
	NumTargets   int64     `json:"num_targets"`
}

// ErrGroupNameNotSpecified is thrown when a group name is not specified
var ErrGroupNameNotSpecified = errors.New("group name not specified")

// Validate performs validation on a group given by the user
func (g *Group) Validate() error {
	if g.Name == "" {
		return ErrGroupNameNotSpecified
	}
	return nil
}

// GetGroups returns the groups owned by the given user.
func GetGroups(uid int64) ([]Group, error) {
	gs := []Group{}
	err := db.Where("user_id=?", uid).Find(&gs).Error
	if err != nil {
		log.Error(err)
		return gs, err
	}
	for i := range gs {
		gs[i].Targets, err = GetTargets(gs[i].Id)
		if err != nil {
			log.Error(err)
		}
	}
	return gs, nil
}

// GetGroupSummaries returns the summaries for the groups
// created by the given uid.
func GetGroupSummaries(uid int64) (GroupSummaries, error) {
	gs := GroupSummaries{}
	query := db.Table("groups").Where("user_id=?", uid)
	err := query.Select("id, name, modified_date").Scan(&gs.Groups).Error
	if err != nil {
		log.Error(err)
		return gs, err
	}
	for i := range gs.Groups {
		query = db.Table("targets").Where("group_id=?", gs.Groups[i].Id)
		err = query.Count(&gs.Groups[i].NumTargets).Error
		if err != nil {
			return gs, err
		}
	}
	gs.Total = int64(len(gs.Groups))
	return gs, nil
}

// GetGroup returns the group, if it exists, specified by the given id and user_id.
func GetGroup(id int64, uid int64) (Group, error) {
	g := Group{}
	err := db.Where("user_id=? and id=?", uid, id).Find(&g).Error
	if err != nil {
		log.Error(err)
		return g, err
	}
	g.Targets, err = GetTargets(g.Id)
	if err != nil {
		log.Error(err)
	}
	return g, nil
}

// GetGroupSummary returns the summary for the requested group
func GetGroupSummary(id int64, uid int64) (GroupSummary, error) {
	g := GroupSummary{}
	query := db.Table("groups").Where("user_id=? and id=?", uid, id)
	err := query.Select("id, name, modified_date").Scan(&g).Error
	if err != nil {
		log.Error(err)
		return g, err
	}
	query = db.Table("group_targets").Where("group_id=?", id)
	err = query.Count(&g.NumTargets).Error
	if err != nil {
		return g, err
	}
	return g, nil
}

// GetGroupByName returns the group, if it exists, specified by the given name and user_id.
func GetGroupByName(n string, uid int64) (Group, error) {
	g := Group{}
	err := db.Where("user_id=? and name=?", uid, n).Find(&g).Error
	if err != nil {
		log.Error(err)
		return g, err
	}
	g.Targets, err = GetTargets(g.Id)
	if err != nil {
		log.Error(err)
	}
	return g, err
}

// PostGroup creates a new group in the database.
func PostGroup(g *Group) error {
	g.CreatedDate = time.Now().UTC()
	err := g.Validate()
	if err != nil {
		return err
	}
	// Insert the group into the DB
	tx := db.Begin()
	err = tx.Save(g).Error
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

// PutGroup updates the given group if found in the database.
func PutGroup(g *Group) error {
	if err := g.Validate(); err != nil {
		return err
	}
	tx := db.Begin()
	err := tx.Save(g).Error
	if err != nil {
		log.Error(err)
		return err
	}
	err = tx.Commit().Error
	if err != nil {
		tx.Rollback()
		return err
	}
	return nil
}

// DeleteGroup deletes a given group
func DeleteGroup(g *Group) error {
	// Delete all the group_targets entries for this group
	err := db.Where("group_id=?", g.Id).Delete(&Target{}).Error
	if err != nil {
		log.Error(err)
		return err
	}
	// Delete the group itself
	err = db.Delete(g).Error
	if err != nil {
		log.Error(err)
		return err
	}
	return err
}
