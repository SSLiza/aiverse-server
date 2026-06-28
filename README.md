# 🌌 AIverse - AI Prompt Sharing & Marketplace Platform

AIverse is a modern, premium AI prompt-sharing and marketplace platform designed to help developers, creators, and AI enthusiasts discover, share, bookmark, and manage optimized prompts for popular tools like ChatGPT, Claude, Gemini, and Midjourney. 

The platform offers a role-based dashboard ecosystem, Stripe payment flows, moderation controls, and responsive UI themes to foster a community-driven prompt ecosystem.

---

## 🚀 Live Links
* **Frontend Application:** [AIverse Client](https://aiverse-client-six.vercel.app)
* **Backend API Server:** [AIverse Server](https://aiverse-server-zeta.vercel.app)

---

## ✨ Key Features

### 🔑 Authentication & Security
* **Social & Credentials Login:** Powered by secure session handling and Google OAuth integration.
* **Role-Based Routing:** Customized flows and middlewares for `USER`, `CREATOR`, and `ADMIN` members.

### 💳 Monetization & Access
* **Stripe Premium Upgrade:** One-time $5 checkout session to unlock premium access.
* **Instant Activation:** Automatically updates subscription plans to `Premium` upon successful checkout.
* **Access Control:** Automatically limits free users to a maximum of 3 prompt submissions.

### 📝 Prompt Management
* **Interactive Marketplace:** Advanced client-side search, category filtering, and sorting parameters.
* **Submissions Pipeline:** Rich metadata fields including Thumbnail upload, AI Tool, Tags, and Difficulty Selector (Beginner, Intermediate, Pro).
* **Review Moderation:** Submitted prompts remain `pending` until reviewed and approved/rejected by an administrator.

### 🔖 Bookmarks & Interactive Reviews
* **Bookmarks Dashboard:** Fast template bookmarking with immediate removal actions.
* **User Review Engine:** Share ratings and reviews. Deleting a review triggers database aggregations to recalculate average ratings.

### 📊 Modern Performance Analytics
* **Interactive Charts:** Recharts analytics illustrating prompt copies, category distribution, and total reviews.
* **Analytics Modal:** Quick performance statistics popup directly from the dashboard table.

### 🌓 Responsive Aesthetics
* **Theme Toggle:** Seamless light and dark mode transitions.
* **Interactive Micro-animations:** Powered by Framer Motion for scroll-triggers, banner animations, and card layouts.

---

## 🛠️ Technology Stack & NPM Packages

### Frontend (Client-Side)
* **Framework:** Next.js (App Router)
* **Styling:** TailwindCSS, DaisyUI, HeroUI (NextUI)
* **Animation:** Framer Motion
* **Analytics:** Recharts
* **State & Flow:** React Context, React Hook Form, Lucide Icons, React Toastify
* **Payments:** Stripe JS SDK (`@stripe/react-stripe-js`, `@stripe/stripe-js`)

### Backend (Server-Side)
* **Runtime & Framework:** Node.js, Express
* **Database:** MongoDB (Native Driver & Mongoose)
* **Security:** JWT, Cors
* **Integrations:** Stripe SDK (Checkout sessions & metadata mapping)

---

## 💻 Local Setup & Installation

### 1. Clone the Workspace
```bash
git clone https://github.com/SSLiza/aiverse-client.git
cd aiverse
```

### 2. Configure Environment Variables

#### Backend (`aiverse-server/.env`)
Create a `.env` file in the server directory with:
```env
PORT=5000
DB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
STRIPE_SECRET_KEY=your_stripe_secret_key
CLIENT_URL=http://localhost:3000
```

#### Frontend (`aiverse-client/.env.local`)
Create a `.env.local` file in the client directory with:
```env
NEXT_PUBLIC_BASE_URL=http://localhost:5000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
NEXTAUTH_SECRET=your_nextauth_secret
```

### 3. Run Locally

#### Run API Server:
```bash
cd aiverse-server
npm install
npm start # or nodemon index.js
```

#### Run Frontend Client:
```bash
cd aiverse-client
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 📌 Future Milestones
* [ ] AI-assisted prompt optimization suggestions before listing.
* [ ] Real-time browser notifications for prompt approval and bookmark updates.
* [ ] Advanced exports for prompts (JSON, TXT, CSV formatting).



---

## 👨‍💻 Developer
* **Name:** Shajeda Sultana
* **Email:** [shajedasultanaliza2002@gmail.com](mailto:shajedasultanaliza2002@gmail.com)
