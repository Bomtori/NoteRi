// src/api/planApi.ts
import apiClient from "./apiClient.js";

export const getPlans = () => apiClient.get("/plans");

// 가격만 변경
export const updatePlanPrice = (id: number, price: number) =>
    apiClient.patch(`/plans/${id}/price`, { price });

// 전체 수정 (duration_days, seconds, desc 포함)
export const updatePlan = (id: number, payload: any) =>
    apiClient.patch(`/plans/${id}`, payload);

// 새 플랜 생성
export const createPlan = (payload: any) => apiClient.post("/plans", payload);

// 플랜 삭제
export const deletePlan = (id: number) => apiClient.delete(`/plans/${id}`);
