package models

import (
	"testing"

	"github.com/niklasent/gophishusb/config"
	"gopkg.in/check.v1"
)

// Hook up gocheck into the "go test" runner.
func Test(t *testing.T) { check.TestingT(t) }

type ModelsSuite struct {
	config *config.Config
}

var _ = check.Suite(&ModelsSuite{})

func (s *ModelsSuite) SetUpSuite(c *check.C) {
	conf := &config.Config{
		DBName:         "sqlite3",
		DBPath:         ":memory:",
		MigrationsPath: "../db/db_sqlite3/migrations/",
	}
	s.config = conf
	err := Setup(conf)
	if err != nil {
		c.Fatalf("Failed creating database: %v", err)
	}
}

func (s *ModelsSuite) TearDownTest(c *check.C) {
	// Clear database tables between each test. If new tables are
	// used in this test suite they will need to be cleaned up here.
	db.Delete(Group{})
	db.Delete(Target{})
	db.Delete(Usb{})
	db.Delete(Result{})
	db.Delete(Campaign{})

	// Reset users table to default state.
	db.Not("id", 1).Delete(User{})
	db.Model(User{}).Update("username", "admin")
}

func (s *ModelsSuite) createCampaignDependencies(ch *check.C) Campaign {
	// Add a group
	group := Group{Name: "Test Group"}
	group.UserId = 1

	// Add a target
	t := Target{}
	t.ApiKey = "11223344556677889900aabbccddeeff"
	t.GroupId = group.Id
	t.Hostname = "TEST-TARGET"
	t.OS = "Windows 11 Test"
	ch.Assert(PostTarget(&t), check.Equals, nil)

	// Append target to group
	group.Targets = append(group.Targets, t)
	ch.Assert(PostGroup(&group), check.Equals, nil)

	// Add a USB
	u := Usb{Name: "Test USB"}
	u.UserId = 1
	ch.Assert(PostUsb(&u), check.Equals, nil)

	c := Campaign{Name: "Test campaign"}
	c.UserId = 1
	c.Groups = []Group{group}
	return c
}

func (s *ModelsSuite) createCampaign(ch *check.C) Campaign {
	c := s.createCampaignDependencies(ch)
	// Setup and "launch" our campaign
	ch.Assert(PostCampaign(&c, c.UserId), check.Equals, nil)

	// For comparing the dates, we need to fetch the campaign again. This is
	// to solve an issue where the campaign object right now has time down to
	// the microsecond, while in MySQL it's rounded down to the second.
	c, _ = GetCampaign(c.Id, c.UserId)
	return c
}

func setupBenchmark(b *testing.B) {
	conf := &config.Config{
		DBName:         "sqlite3",
		DBPath:         ":memory:",
		MigrationsPath: "../db/db_sqlite3/migrations/",
	}
	err := Setup(conf)
	if err != nil {
		b.Fatalf("Failed creating database: %v", err)
	}
}

func tearDownBenchmark(b *testing.B) {
	err := db.Close()
	if err != nil {
		b.Fatalf("error closing database: %v", err)
	}
}

func resetBenchmark(b *testing.B) {
	db.Delete(Group{})
	db.Delete(Target{})
	db.Delete(Usb{})
	db.Delete(Result{})
	db.Delete(Campaign{})

	// Reset users table to default state.
	db.Not("id", 1).Delete(User{})
	db.Model(User{}).Update("username", "admin")
}
