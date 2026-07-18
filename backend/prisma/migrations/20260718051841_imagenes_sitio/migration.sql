-- CreateTable
CREATE TABLE "ImagenSitio" (
    "id" UUID NOT NULL,
    "clave" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT NOT NULL DEFAULT '',
    "actualizadaEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImagenSitio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImagenSitio_clave_key" ON "ImagenSitio"("clave");
