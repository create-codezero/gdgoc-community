package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv" // Added the dotenv loader package
)

type Part struct {
	Text string `json:"text"`
}

type Content struct {
	Parts []Part `json:"parts"`
}

type GeminiRequest struct {
	Contents []Content `json:"contents"`
}

func main() {
	// ⚡ Load the .env file automatically when the application boots up
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: No .env file found. Falling back to system environment variables.")
	}

	app := fiber.New()
	app.Use(logger.New())

	// Serve static files (CSS, JS) from the "public" directory
	app.Static("/static", "./public")

	// HTML Route: Landing / Login Page
	app.Get("/", func(c *fiber.Ctx) error {
		return c.SendFile("./views/index.html")
	})

	// HTML Route: Dashboard
	app.Get("/dashboard", func(c *fiber.Ctx) error {
		return c.SendFile("./views/dashboard.html")
	})

	// HTML Route: Discussion (NEW)
	app.Get("/discussion", func(c *fiber.Ctx) error {
		return c.SendFile("./views/discussion.html")
	})

	app.Get("/groupmeet", func(c *fiber.Ctx) error {
		return c.SendFile("./views/groupmeet.html")
	})

	// API Route: Secure Proxy to Google Gemini AI API
	app.Post("/api/ai-buddy", func(c *fiber.Ctx) error {
		type Body struct {
			Prompt string `json:"prompt"`
		}
		var input Body
		if err := c.BodyParser(&input); err != nil {
			return c.Status(400).SendString("Invalid request")
		}

		apiKey := os.Getenv("GEMINI_API_KEY")
		if apiKey == "" {
			log.Println("ERROR: GEMINI_API_KEY is not defined inside the environment setup!")
			return c.Status(500).SendString("Internal configuration profile missing API credentials")
		}

		geminiURL := "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=" + apiKey

		payload := GeminiRequest{
			Contents: []Content{
				{Parts: []Part{{Text: input.Prompt}}},
			},
		}
		jsonData, err := json.Marshal(payload)
		if err != nil {
			return c.Status(500).SendString("Failed to process payload")
		}

		req, err := http.NewRequestWithContext(c.UserContext(), "POST", geminiURL, bytes.NewBuffer(jsonData))
		if err != nil {
			return c.Status(500).SendString("Failed to initialize upstream request")
		}
		req.Header.Set("Content-Type", "application/json")

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			return c.Status(500).SendString("AI Service Unreachable")
		}
		defer resp.Body.Close()

		respBody, _ := io.ReadAll(resp.Body)

		if resp.StatusCode != http.StatusOK {
			fmt.Printf("[Gemini Upstream Error %d]: %s\n", resp.StatusCode, string(respBody))
		}

		return c.Status(resp.StatusCode).Type("json").Send(respBody)
	})

	log.Fatal(app.Listen(":3000"))
}