# 🏫 Campus_HelpDesk

A comprehensive full-stack web application built to streamline campus management processes. This platform provides a centralized and efficient interface for students and staff to manage and resolve campus-related queries effectively.

---

## 🚀 Key Features

* **Query Management System:** Submit, track, and resolve helpdesk tickets in real-time.
* **Role-Based Access:** Dedicated interfaces for students and administrative staff.
* **Responsive UI:** Built with modern CSS frameworks for a seamless experience across devices.
* **Scalable Architecture:** Designed for easy maintenance and future feature integration.

---

## 🛠 Tech Stack

This project leverages modern web technologies to ensure performance and maintainability:

* **Frontend:** HTML5, CSS3, Tailwind CSS, JavaScript (ES6+)
* **Backend:** Node.js, Express.js
* **Database:** MongoDB
* **Development Tools:** Git, PostCSS, NPM

---

## ⚙️ Installation & Setup

Follow these steps to run the project locally:

### 1. Clone the Repository

```bash
git clone https://github.com/Venky951/Campus_HelpDesk.git
cd Campus_HelpDesk
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory and add the following:

```env
MONGO_URI=your_mongodb_connection_string
SESSION_SECRET=replace_with_a_long_random_secret
NODE_ENV=development
PORT=3000
```

Required variables:

- `MONGO_URI`: MongoDB connection string for the application database and session store.
- `SESSION_SECRET`: A long, unique secret used to sign session cookies. Never commit or share this value.

Optional variables:

- `NODE_ENV`: Use `production` for production deployment; defaults to development behavior when omitted.
- `PORT`: HTTP port; defaults to `3000`.

The application validates `MONGO_URI` and `SESSION_SECRET` before initializing the database or session store and exits with a configuration error if either is missing.

GridFS attachments are stored in MongoDB. Orphan cleanup is intentionally not run automatically: uploads create a GridFS file before the ticket reference is saved, so an automatic cleanup job could delete a valid in-progress upload. Use a separately controlled maintenance process with an upload grace period and operational locking before removing confirmed orphaned files.

### 4. Start the Development Server

```bash
npm start
```

The application will be accessible at:

```bash
http://localhost:3000
```

---

## 📂 Project Structure

```plaintext
Campus_HelpDesk/
├── controllers/         # Request handling logic
├── models/              # Database schemas
├── routes/              # API endpoint definitions
├── public/              # Static assets (CSS, Images)
├── views/               # UI templates
├── app.js               # Main application entry point
└── tailwind.config.js   # Tailwind CSS configuration
```

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are greatly appreciated.

1. Fork the project
2. Create your feature branch

```bash
git checkout -b feature/AmazingFeature
```

3. Commit your changes

```bash
git commit -m "Add some AmazingFeature"
```

4. Push to the branch

```bash
git push origin feature/AmazingFeature
```

5. Open a Pull Request

---

## 📧 Contact


[Venkatesh Maloth - LinkedIn](https://www.linkedin.com/in/maloth-venkatesh) | [Email Me](mailto:malothvenky12@gmail.com)

---

Built with ❤️ by Venkatesh Maloth
