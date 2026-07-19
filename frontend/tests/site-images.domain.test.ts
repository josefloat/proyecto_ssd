import { describe, expect, it } from "vitest";
import {
  CLAVE_HERO,
  CLAVE_VIDEO_FONDO,
  claveEspecialidad,
  claveHero,
  clavesHero,
  fondoDeVideo,
  fotoDeEspecialidad,
  fotosDelHero,
  slugEspecialidad,
  type MapaImagenes,
} from "../lib/site-images";

// El backend solo acepta claves en minúsculas, sin tildes ni "_"
// (backend/src/domain/imagenes-sitio.ts). Este es el contrato que el panel y
// la home deben respetar al construirlas desde el nombre de la especialidad.
const SLUG_BACKEND = /^[a-z0-9][a-z0-9-]{1,62}$/;

const ESPECIALIDADES_CANONICAS = [
  "Medicina General",
  "Cardiología",
  "Pediatría",
  "Traumatología",
  "Ginecología",
  "Dermatología",
];

function imagen(clave: string, url: string, alt = ""): MapaImagenes[string] {
  return { clave, url, alt };
}

describe("claves de imagen derivadas del sitio", () => {
  it("toda especialidad canónica produce una clave que el backend acepta", () => {
    // Arrange / Act
    const claves = ESPECIALIDADES_CANONICAS.map(claveEspecialidad);

    // Assert
    for (const clave of claves) {
      expect(clave).toMatch(SLUG_BACKEND);
    }
    expect(claves).toContain("especialidad-medicina-general");
    expect(claves).toContain("especialidad-cardiologia");
  });

  it("el slug quita tildes y normaliza separadores", () => {
    // Arrange / Act / Assert
    expect(slugEspecialidad("Ginecología")).toBe("ginecologia");
    expect(slugEspecialidad("Medicina General")).toBe("medicina-general");
    expect(slugEspecialidad("  Salud  Mental  ")).toBe("salud-mental");
  });

  it("las claves de portada van con dos dígitos para ordenar como el backend", () => {
    // Arrange / Act
    const claves = clavesHero();

    // Assert — el backend ordena por clave ASC lexicográfico, así que
    // "hero-home-10" no debe adelantarse a "hero-home-02".
    expect(claves[0]).toBe(CLAVE_HERO);
    expect(claves[1]).toBe("hero-home-02");
    expect([...claves].sort()).toEqual([...claves]);
    for (const clave of claves) {
      expect(clave).toMatch(SLUG_BACKEND);
    }
    expect(CLAVE_VIDEO_FONDO).toMatch(SLUG_BACKEND);
  });
});

describe("lectura de las colecciones publicadas", () => {
  it("la portada conserva el orden y salta los huecos sin publicar", () => {
    // Arrange — el ADMIN subió la primera y la tercera, no la segunda.
    const imagenes: MapaImagenes = {
      [claveHero(2)]: imagen(claveHero(2), "/tres.png"),
      [claveHero(0)]: imagen(claveHero(0), "/una.png", "Portada"),
    };

    // Act
    const fotos = fotosDelHero(imagenes);

    // Assert
    expect(fotos.map((foto) => foto.url)).toEqual(["/una.png", "/tres.png"]);
  });

  it("sin portadas publicadas devuelve una lista vacía (la home usa su fallback)", () => {
    // Arrange / Act / Assert
    expect(fotosDelHero({})).toEqual([]);
  });

  it("la foto de una especialidad se busca por su nombre canónico", () => {
    // Arrange
    const clave = claveEspecialidad("Cardiología");
    const imagenes: MapaImagenes = { [clave]: imagen(clave, "/corazon.png") };

    // Act / Assert
    expect(fotoDeEspecialidad(imagenes, "Cardiología")?.url).toBe("/corazon.png");
    expect(fotoDeEspecialidad(imagenes, "Pediatría")).toBeUndefined();
  });

  it("el fondo en vídeo solo existe si hay vídeo, y el póster es opcional", () => {
    // Arrange
    const conVideo: MapaImagenes = {
      [CLAVE_VIDEO_FONDO]: imagen(CLAVE_VIDEO_FONDO, "/fondo.mp4"),
    };

    // Act / Assert
    expect(fondoDeVideo({})).toBeNull();
    expect(fondoDeVideo(conVideo)).toEqual({ url: "/fondo.mp4", poster: "" });
  });
});
