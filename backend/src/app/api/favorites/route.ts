import { NextRequest } from "next/server";
import { getUserFavoritesController, toggleFavoriteController } from "@/modules/favorites/favorites.controller";

export async function GET(req: NextRequest) {
  return getUserFavoritesController(req);
}

export async function POST(req: NextRequest) {
  return toggleFavoriteController(req);
}
