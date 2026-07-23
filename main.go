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
	"github.com/gofiber/template/html/v2"
	"github.com/joho/godotenv"
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
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: No .env file found.")
	}

	engine := html.New("./views", ".html")
	
	app := fiber.New(fiber.Config{
		Views: engine,
	})

	app.Use(logger.New())

	
	app.Static("/static", "./public")

	
	app.Get("/favicon.ico", func(c *fiber.Ctx) error {
		return c.SendStatus(204)
	})

	
	app.Get("/", func(c *fiber.Ctx) error {
		return c.Render("index", nil)
	})

	app.Get("/dashboard", func(c *fiber.Ctx) error {
		return c.Render("dashboard", nil)
	})

	app.Get("/discussion", func(c *fiber.Ctx) error {
		return c.Render("discussion", nil)
	})

	// app.Get("/groupmeet", func(c *fiber.Ctx) error {
	// 	return c.Render("groupmeet", nil)
	// })

	app.Get("/turn-credentials", func(c *fiber.Ctx) error {
		apiKey := os.Getenv("METERED_API_KEY")
		if apiKey == "" {
			return c.Status(500).SendString("Missing Metered API Key")
		}
		
		resp, err := http.Get(fmt.Sprintf("https://YOUR_APP.metered.live/api/v1/turn/credentials?apiKey=%s", apiKey))
		if err != nil {
			return c.Status(500).SendString("Error fetching TURN credentials")
		}
		defer resp.Body.Close()

		
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return c.Status(500).SendString("Error reading response")
		}

		var iceServers []interface{}
		if err := json.Unmarshal(body, &iceServers); err != nil {
			return c.Status(500).SendString("Error parsing JSON")
		}

		return c.JSON(fiber.Map{"iceServers": iceServers})
	})

	
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
			return c.Status(500).SendString("Missing GEMINI_API_KEY")
		}

		// geminiURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=%s", apiKey)
		geminiURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=%s", apiKey)   

		payload := GeminiRequest{
			Contents: []Content{{Parts: []Part{{Text: input.Prompt}}}},
		}
		jsonData, err := json.Marshal(payload)
		if err != nil {
			return c.Status(500).SendString("Failed to marshal payload")
		}

		req, err := http.NewRequestWithContext(c.UserContext(), "POST", geminiURL, bytes.NewBuffer(jsonData))
		if err != nil {
			return c.Status(500).SendString("Request initialization failed")
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return c.Status(500).SendString("AI Service Unreachable")
		}
		defer resp.Body.Close()

		respBody, _ := io.ReadAll(resp.Body)
		return c.Status(resp.StatusCode).Type("json").Send(respBody)
	})

	log.Fatal(app.Listen(":3000"))
}   
