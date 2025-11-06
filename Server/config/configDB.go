package config

import (
	"context"
	"log"

	"cloud.google.com/go/firestore"
	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
	"google.golang.org/api/option"
)

var (
	App    *firebase.App
	Ctx    = context.Background()
	Auth   *auth.Client
	Client *firestore.Client
	DB     *firestore.Client
)

func InitFirebase() {
	// 🔑 path ไปยัง service account key ของคุณ
	opt := option.WithCredentialsFile("./config/meeble-project-firebaseKey.json")

	app, err := firebase.NewApp(Ctx, nil, opt)
	if err != nil {
		log.Fatalf("❌ error initializing firebase app: %v", err)
	}
	App = app

	client, err := app.Firestore(Ctx)
	if err != nil {
		log.Fatalf("❌ error initializing firestore: %v", err)
	}
	Client = client
	DB, err = app.Firestore(Ctx)
	if err != nil {
		log.Fatalf("error initializing firestore: %v", err)
	}

	authClient, err := app.Auth(Ctx)
	if err != nil {
		log.Fatalf("❌ error initializing auth: %v", err)
	}
	Auth = authClient

	log.Println("✅ Firebase & Firestore initialized successfully")
}
