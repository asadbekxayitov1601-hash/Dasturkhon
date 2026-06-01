-- CreateTable
CREATE TABLE "RecipeView" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recipeId" INTEGER NOT NULL,
    "viewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecipeView_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RecipeView_recipeId_idx" ON "RecipeView"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeView_viewedAt_idx" ON "RecipeView"("viewedAt");
