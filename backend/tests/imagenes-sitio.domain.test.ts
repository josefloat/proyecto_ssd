import { describe, expect, it } from "vitest";
import {
  validarClaveImagen,
  validarImagenSitio,
} from "../src/domain/imagenes-sitio";
import { PersonalApiError } from "../src/domain/personal-api";

const UPLOAD_IMAGEN =
  "https://res.cloudinary.com/senal-de-vida/image/upload/v1/senal-de-vida/hero.jpg";
const UPLOAD_VIDEO =
  "https://res.cloudinary.com/senal-de-vida/video/upload/v1/senal-de-vida/fondo.mp4";

describe("validación de claves de imagen del sitio", () => {
  it("acepta los slugs que publica el panel, incluidas las claves numeradas", () => {
    // Arrange
    const claves = [
      "hero-home",
      "hero-home-02",
      "especialidad-medicina-general",
      "video-fondo-home",
      "fondo-login",
    ];

    // Act / Assert
    for (const clave of claves) {
      expect(validarClaveImagen(clave)).toBe(clave);
    }
  });

  it("normaliza a minúsculas la clave de retrato de un médico", () => {
    // Arrange
    const clave = "medico:3F1B0A7C-9D2E-4A55-B8C1-0E4D6F2A9B31";

    // Act
    const normalizada = validarClaveImagen(clave);

    // Assert
    expect(normalizada).toBe(clave.toLowerCase());
  });

  it("rechaza claves con mayúsculas, espacios, tildes o prefijos desconocidos", () => {
    // Arrange
    const invalidas = [
      "Hero-Home",
      "hero home",
      "especialidad-cardiología",
      "especialidad:3f1b0a7c-9d2e-4a55-b8c1-0e4d6f2a9b31",
      "-empieza-con-guion",
      "x",
      42,
      null,
    ];

    // Act / Assert
    for (const clave of invalidas) {
      expect(() => validarClaveImagen(clave)).toThrow(PersonalApiError);
    }
  });
});

describe("validación del cuerpo de una imagen del sitio", () => {
  it("acepta una entrega de imagen de Cloudinary y recorta el alt", () => {
    // Arrange
    const cuerpo = { url: UPLOAD_IMAGEN, alt: "  Equipo de la clínica  " };

    // Act
    const validado = validarImagenSitio(cuerpo);

    // Assert
    expect(validado).toEqual({
      url: UPLOAD_IMAGEN,
      alt: "Equipo de la clínica",
    });
  });

  it("acepta una entrega de vídeo de Cloudinary (fondo animado de la home)", () => {
    // Arrange
    const cuerpo = { url: UPLOAD_VIDEO, alt: "" };

    // Act
    const validado = validarImagenSitio(cuerpo);

    // Assert
    expect(validado.url).toBe(UPLOAD_VIDEO);
  });

  it("deja el alt vacío cuando no se envía", () => {
    // Arrange / Act
    const validado = validarImagenSitio({ url: UPLOAD_IMAGEN });

    // Assert
    expect(validado.alt).toBe("");
  });

  it("rechaza orígenes ajenos a Cloudinary y recursos no soportados", () => {
    // Arrange
    const invalidas = [
      "https://ejemplo.com/foto.jpg",
      "http://res.cloudinary.com/senal-de-vida/image/upload/v1/x.jpg",
      "https://res.cloudinary.com/senal-de-vida/raw/upload/v1/x.pdf",
      `https://res.cloudinary.com/senal de vida/image/upload/x.jpg`,
      `${UPLOAD_IMAGEN}?${"a".repeat(600)}`,
    ];

    // Act / Assert
    for (const url of invalidas) {
      expect(() => validarImagenSitio({ url })).toThrow(PersonalApiError);
    }
  });

  it("rechaza cuerpos que no son objetos o con alt fuera de rango", () => {
    // Arrange / Act / Assert
    expect(() => validarImagenSitio(null)).toThrow(PersonalApiError);
    expect(() => validarImagenSitio([UPLOAD_IMAGEN])).toThrow(PersonalApiError);
    expect(() =>
      validarImagenSitio({ url: UPLOAD_IMAGEN, alt: "a".repeat(301) }),
    ).toThrow(PersonalApiError);
    expect(() => validarImagenSitio({ url: UPLOAD_IMAGEN, alt: 7 })).toThrow(
      PersonalApiError,
    );
  });
});
