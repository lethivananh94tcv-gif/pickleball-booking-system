import { apiClient } from "@/services/apiClient";
import type { ApiResponse } from "@/types/api";

export interface FavoriteRecord {
  TargetType: "Court" | "Coach";
  TargetID: number;
}

export async function getFavorites(token: string): Promise<FavoriteRecord[]> {
  const response = await apiClient<ApiResponse<FavoriteRecord[]>>("/api/favorites", {
    token,
  });
  return response.data;
}

export async function toggleFavorite(
  token: string,
  targetType: "Court" | "Coach",
  targetId: number
): Promise<boolean> {
  const response = await apiClient<ApiResponse<{ isFavorite: boolean }>>("/api/favorites", {
    method: "POST",
    token,
    body: { targetType, targetId },
  });
  return response.data.isFavorite;
}
