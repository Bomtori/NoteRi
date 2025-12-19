import apiClient from "./apiClient";

export async function generateTemplate(payload) {
  const res = await apiClient.post("/ollama/template", payload);
  return res.data.template;
}
