package config

import (
	"crypto/tls"

	"gopkg.in/gomail.v2"
)

var Mailer *gomail.Dialer
func ConnectMailer(host, username, password string) {
	mailer := gomail.NewDialer(
		host,
		587,
		username,
		password,
	)
	mailer.TLSConfig = &tls.Config{InsecureSkipVerify: true}
	Mailer = mailer
}