# BigQuery Release Explorer

A modern, responsive, and feature-rich web application built with **Python Flask** and **Vanilla Web Technologies** (HTML5, JS, CSS) to fetch, explore, search, filter, and tweet about the official Google Cloud BigQuery release notes.

![App Preview](https://img.shields.io/badge/BigQuery-Release--Explorer-blue?style=for-the-badge&logo=googlecloud&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.13+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.1+-000000?style=for-the-badge&logo=flask&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

---

## 🚀 Features

*   **Real-time Atom Feed Fetching:** Downloads and parses Google Cloud's official BigQuery release notes RSS/Atom feed directly.
*   **Intelligent Caching:** Implements server-side in-memory caching (10-minute duration) to prevent rate limits and ensure lightning-fast load times.
*   **Granular Entry Parsing:** Parses Google's combined date entries into individual updates (Features, Announcements, Issues, Changes, Deprecations) using the browser's native `DOMParser`.
*   **Live Multi-Field Search:** Instantly filters updates as you type, matching against content, category types, or release dates.
*   **Dynamic Badge Filters:** One-click filtering to view specific kinds of releases (e.g. only *Features* or *Issues*).
*   **Custom Tweet Composer Modal:** A simulated Twitter/X UI mockup that:
    *   Generates automatic text summaries with doc links and hashtags.
    *   Tracks character counts in real-time (280-character limit indicator).
    *   Opens official X Web Intents for seamless sharing or provides a quick "Copy to Clipboard" fallback.
*   **Premium Dark UI:** Designed with modern glassmorphic overlays, responsive dual-column navigation, and fluid CSS micro-animations.

---

## 📁 Project Structure

```text
bq_viewer/
│
├── app.py                # Flask Backend (XML fetch, cache, endpoint routing)
├── requirements.txt      # Python Dependencies (Flask)
├── .gitignore            # Git exclusion rules
├── README.md             # Project documentation
│
├── templates/
│   └── index.html        # Main HTML skeleton and modal template
│
└── static/
    ├── style.css         # UI Styling (Variables, Glassmorphism, Responsive layout)
    └── app.js            # Frontend logic (DOM parsing, Search, Twitter composer)
```

---

## 🛠️ Getting Started

### Prerequisites

Make sure you have **Python 3.13 or newer** and **Git** installed on your system.

### Installation

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/Huzai134/bq-release-notes.git
    cd bq-release-notes
    ```

2.  **Create a Virtual Environment:**
    ```bash
    python -m venv venv
    ```

3.  **Activate the Virtual Environment:**
    *   **Windows (PowerShell):**
        ```powershell
        .\venv\Scripts\Activate.ps1
        ```
    *   **Windows (CMD):**
        ```cmd
        .\venv\Scripts\activate.bat
        ```
    *   **Linux / macOS:**
        ```bash
        source venv/bin/activate
        ```

4.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

---

## 💻 Running the App

1.  Start the Flask development server:
    ```bash
    python app.py
    ```
2.  Open your browser and navigate to:
    ```text
    http://127.0.0.1:5000/
    ```

---

## 📖 How It Works (Technical Overview)

### The Request/Response Pipeline

1.  **Load/Refresh Trigger:** When loading the page or clicking **Refresh Data**, the frontend requests `/api/releases?refresh=true`.
2.  **Server Fetching:** The backend checks the query parameter. If `refresh=true`, it bypasses the in-memory dictionary cache and requests the raw XML feed from Google.
3.  **Namespace Parsing:** The server parses the Atom XML using Python's standard `xml.etree.ElementTree` and maps element tags using standard namespaces.
4.  **Granular Splitting:** Once the client receives the entries JSON, it uses JavaScript's `DOMParser` to group HTML content tags by the `<h3>` headers inside each update.
5.  **Social Sharing:** Clicking the **Tweet Update** button pre-fills the tweet template, formats the snippet, updates the Twitter card preview, and prepares the Web Intent URL.
