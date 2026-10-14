# Frontend Flow & UI Tasks

This document outlines the essential frontend tasks to complete before the React/Vite application can be deployed cleanly.

## 1. API Integration Fixes
- [ ] **Remove Hardcoded Dates:** Once the backend Availability API is fixed, remove any hardcoded past dates in the booking UI and revert to dynamic future date selection.
- [ ] **Patient Creation Handling:** Improve the Frontend Patient Creation form to gracefully handle any 500 errors or non-JSON backend responses (like the current serialization error), displaying a user-friendly alert component instead of crashing.

## 2. Environment Variables & Build
- [ ] **Production Config:** Ensure the frontend points to the correct production backend URL using Vite environment variables (e.g., `VITE_API_BASE_URL=https://api.cvraman.health`). Use `.env.production` for these settings.
- [ ] **Build Verification:** Run `npm run build` locally and resolve any TypeScript/ESLint warnings or missing dependencies that arise during the Vite build process. Test the generated `./dist` files using `npm run preview`.

## 3. User Interface & Flow Checks
- [ ] **Real-time Stats Verification:** Ensure the real-time stats logic (completed in `E2E_TEST_RESULTS.md`) performs efficiently on the dashboard without sending excessive requests on every re-render.
- [ ] **Provider Profiles:** Verify the new `/providers/:id` profile route has sufficient loading states and error boundaries in case a provider doesn't exist.
- [ ] **Navigation Check:** Perform an end-to-end manual click-through of the sidebar navigation to ensure all links (`/appointments`, `/providers`, etc.) reflect the correct dynamic active state.

## 4. Final Deployment Steps
- [ ] **Hosting Setup:** Prepare the frontend for deployment to platforms like Vercel, Netlify, or similar, ensuring SPA routing is handled correctly (e.g., rewrite rules for `/` paths).
- [ ] **Asset Optimization:** Ensure all SVG icons and large images are optimized and properly sized to improve First Contentful Paint.
