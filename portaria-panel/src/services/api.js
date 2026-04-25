import axios from "axios";

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const isLocalEnvironment =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);

export const api = axios.create({
  baseURL: configuredBaseUrl || (isLocalEnvironment ? "http://127.0.0.1:5000" : ""),
  timeout: 10000,
});
