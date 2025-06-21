package models

import (
	"errors"
	"time"

	log "github.com/niklasent/gophishusb/logger"
)

type Usb struct {
	Id             int64     `json:"id"`
	UserId         int64     `json:"-"`
	Name           string    `json:"name" sql:"not null"`
	RegisteredDate time.Time `json:"registered_date"`
}

// ErrUsbNameNotSpecified indicates a USB does not have a serial number
var ErrUsbNameNotSpecified = errors.New("name not specified")

// Validate checks to make sure there are no invalid fields in a submitted campaign
func (u *Usb) Validate() error {
	if u.Name == "" {
		return ErrUsbNameNotSpecified
	}
	return nil
}

// CheckUsb checks whether an USB is allowed for a target
func CheckUsb(name string, tid int64) (bool, error) {
	u := Usb{}
	err := db.Where("name = ?", name).Find(&u).Error
	if err != nil {
		log.Errorf("%s: USB not found", err)
		return false, err
	}
	t := Target{}
	err = db.Where("id = ?", tid).Find(&t).Error
	if err != nil {
		log.Errorf("%s: Target not found", err)
		return false, err
	}
	g := Group{}
	err = db.Where("id = ?", t.GroupId).Find(&g).Error
	if err != nil {
		log.Errorf("%s: Target is orphaned", err)
		return false, err
	}
	if g.UserId != u.UserId {
		return false, err
	}
	return true, err
}

// GetUsbs returns the USBs
func GetUsbs(uid int64) ([]Usb, error) {
	us := []Usb{}
	err := db.Model(&User{Id: uid}).Related(&us).Error
	if err != nil {
		log.Error(err)
	}
	return us, err
}

// GetUsb returns the USB, if it exists, specified by the given id.
func GetUsb(id int64, uid int64) (Usb, error) {
	u := Usb{}
	err := db.Where("id = ?", id).Where("user_id = ?", uid).Find(&u).Error
	if err != nil {
		log.Errorf("%s: USB not found", err)
	}
	return u, err
}

// PostUsb registers a new USB and creates a database entry.
func PostUsb(u *Usb) error {
	err := u.Validate()
	if err != nil {
		return err
	}
	// Fill in the details
	u.RegisteredDate = time.Now().UTC()
	// Insert into the DB
	err = db.Save(u).Error
	if err != nil {
		log.Error(err)
	}
	return err
}

// DeleteUsb deletes the specifies USB from the database.
func DeleteUsb(u *Usb) error {
	err := db.Delete(u).Error
	if err != nil {
		log.Error(err)
		return err
	}
	return err
}
