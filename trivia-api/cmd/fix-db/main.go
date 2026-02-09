package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/lib/pq"
)

func main() {
	// Читаем пароль из переменной окружения (без fallback для безопасности)
	password := os.Getenv("DATABASE_PASSWORD")
	if password == "" {
		log.Fatal("DATABASE_PASSWORD environment variable is required")
	}
	connStr := fmt.Sprintf("host=localhost port=5432 user=postgres password=%s dbname=trivia_db sslmode=disable", password)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatal(err)
	}

	driver, err := postgres.WithInstance(db, &postgres.Config{})
	if err != nil {
		log.Fatal(err)
	}

	m, err := migrate.NewWithDatabaseInstance(
		"file://migrations",
		"postgres",
		driver,
	)
	if err != nil {
		log.Fatal(err)
	}

	// Force version 7 (the one before the failed version 8)
	// This cleans the dirty state and sets version to 7.
	version := 7
	fmt.Printf("Forcing migration version to %d to clean dirty state...\n", version)

	if err := m.Force(version); err != nil {
		log.Fatalf("Failed to force version: %v", err)
	}

	fmt.Println("Success! Dirty state cleaned. You can now run the app normally.")
}
