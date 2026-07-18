"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageOff, Trash2, UploadCloud } from "lucide-react";
import { AdminShell } from "./admin-shell";
import {
  eliminarImagenAdmin,
  guardarImagenAdmin,
  listarImagenesSitio,
  obtenerCatalogosAdmin,
} from "@/lib/personal-client";
import { subirImagenCloudinary } from "@/lib/cloudinary-upload";
import type { CatalogosAdmin, ImagenSitioAdmin } from "@/lib/personal-types";

// Claves fijas de las imágenes generales del sitio. Los retratos usan la
// clave "medico:<id>" y se listan desde el catálogo real de médicos.
const IMAGENES_SITIO = [
  {
    clave: "hero-home",
    titulo: "Portada de la home",
    descripcion: "Foto principal que ven los pacientes al entrar al sitio.",
  },
  {
    clave: "clinica-recepcion",
    titulo: "Recepción y admisión",
    descripcion: "Primera foto de la sección \"Conoce la clínica\" en la home.",
  },
  {
    clave: "clinica-consultorios",
    titulo: "Consultorios",
    descripcion: "Segunda foto de la sección \"Conoce la clínica\" en la home.",
  },
  {
    clave: "clinica-laboratorio",
    titulo: "Laboratorio y apoyo",
    descripcion: "Tercera foto de la sección \"Conoce la clínica\" en la home.",
  },
  {
    clave: "fondo-login",
    titulo: "Fondo del acceso del personal",
    descripcion: "Panel visual de la pantalla de inicio de sesión.",
  },
] as const;

type MapaImagenes = Record<string, ImagenSitioAdmin>;

function mensajeDeError(fallo: unknown): string {
  const status = (fallo as { status?: number }).status;
  const detalle = (fallo as { detalle?: string }).detalle;
  const mensaje = (fallo as { message?: string }).message;
  if (status === 503 || mensaje === "FIRMA_FALLIDA") {
    return "Cloudinary no está configurado en el servidor (revisa CLOUDINARY_API_SECRET).";
  }
  if (mensaje === "ARCHIVO_NO_IMAGEN") return "El archivo elegido no es una imagen.";
  if (mensaje === "ARCHIVO_MUY_GRANDE") return "La imagen supera el límite de 10 MB.";
  if (detalle) return `Cloudinary rechazó la subida: ${detalle}`;
  return "No pudimos actualizar la imagen. Intenta nuevamente.";
}

export function AdminImagenesScreen() {
  const router = useRouter();
  const [imagenes, setImagenes] = useState<MapaImagenes | null>(null);
  const [medicos, setMedicos] = useState<CatalogosAdmin["medicos"] | null>(null);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [ocupada, setOcupada] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listarImagenesSitio(), obtenerCatalogosAdmin()])
      .then(([lista, catalogos]) => {
        setImagenes(Object.fromEntries(lista.map((item) => [item.clave, item])));
        setMedicos(catalogos.medicos);
      })
      .catch((fallo: { status?: number }) => {
        if (fallo.status === 401 || fallo.status === 403) {
          router.replace("/personal/login");
        } else {
          setError("No pudimos cargar las imágenes del sitio.");
        }
      });
  }, [router]);

  async function reemplazar(clave: string, archivo: File | null, alt: string) {
    if (!archivo || ocupada) return;
    setOcupada(clave);
    setError("");
    setExito("");
    try {
      const url = await subirImagenCloudinary(archivo);
      const guardada = await guardarImagenAdmin(clave, { url, alt });
      setImagenes((mapa) => ({ ...(mapa ?? {}), [clave]: guardada }));
      setExito(
        "Imagen actualizada. El sitio público la mostrará en unos minutos.",
      );
    } catch (fallo) {
      const status = (fallo as { status?: number }).status;
      if (status === 401) {
        router.replace("/personal/login");
        return;
      }
      setError(mensajeDeError(fallo));
    } finally {
      setOcupada(null);
    }
  }

  async function quitar(clave: string) {
    if (ocupada) return;
    setOcupada(clave);
    setError("");
    setExito("");
    try {
      await eliminarImagenAdmin(clave);
      setImagenes((mapa) => {
        const copia = { ...(mapa ?? {}) };
        delete copia[clave];
        return copia;
      });
      setExito("Imagen quitada; el sitio vuelve a su diseño por defecto.");
    } catch {
      setError("No se pudo quitar la imagen.");
    } finally {
      setOcupada(null);
    }
  }

  const cargando = imagenes === null || medicos === null;

  return (
    <AdminShell
      actual="imagenes"
      titulo="Imágenes del sitio"
      subtitulo="Portada, fondos y retratos publicados mediante Cloudinary"
    >
      {error ? (
        <div className="admin-state admin-error" role="alert">{error}</div>
      ) : null}
      {exito ? (
        <div className="admin-state admin-success" role="status">{exito}</div>
      ) : null}
      {cargando && !error ? (
        <div className="admin-state" role="status">Cargando imágenes…</div>
      ) : null}

      {!cargando ? (
        <>
          <p className="admin-images-intro">
            Sube una imagen para reemplazar la actual; el cambio se publica sin
            redesplegar. Si quitas una imagen, el sitio usa su diseño por
            defecto.
          </p>

          <section aria-label="Imágenes generales del sitio">
            <div className="admin-images-grid">
              {IMAGENES_SITIO.map(({ clave, titulo, descripcion }) => {
                const actual = imagenes?.[clave];
                const subiendo = ocupada === clave;
                return (
                  <article className="image-card" key={clave}>
                    <div className="image-card-preview">
                      {actual ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={actual.url} alt={actual.alt || titulo} />
                      ) : (
                        <span>
                          <ImageOff aria-hidden="true" size={19} /> Sin imagen — se
                          usa el diseño por defecto
                        </span>
                      )}
                    </div>
                    <div className="image-card-body">
                      <strong>{titulo}</strong>
                      <small>{descripcion}</small>
                      <div className="image-card-actions">
                        <label
                          className={`upload-button ${subiendo ? "is-disabled" : ""}`}
                        >
                          <UploadCloud aria-hidden="true" size={21} />
                          {subiendo
                            ? "Subiendo…"
                            : actual
                              ? "Reemplazar"
                              : "Subir imagen"}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={Boolean(ocupada)}
                            onChange={(event) => {
                              void reemplazar(
                                clave,
                                event.target.files?.[0] ?? null,
                                actual?.alt || titulo,
                              );
                              event.target.value = "";
                            }}
                          />
                        </label>
                        {actual ? (
                          <button
                            type="button"
                            className="ghost-button"
                            disabled={Boolean(ocupada)}
                            onClick={() => void quitar(clave)}
                          >
                            <Trash2 aria-hidden="true" size={20} /> Quitar
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section aria-label="Retratos de los médicos">
            <h2 className="admin-images-subtitle">Retratos de los médicos</h2>
            <p className="admin-images-intro">
              El retrato aparece en el flujo público de reserva junto al nombre
              del médico. Sin retrato se muestran sus iniciales.
            </p>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Retrato</th>
                    <th>Médico</th>
                    <th>Especialidad</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {medicos?.map((medico) => {
                    const clave = `medico:${medico.id}`;
                    const actual = imagenes?.[clave];
                    const subiendo = ocupada === clave;
                    const iniciales = medico.nombre
                      .replace(/^(Dr\.|Dra\.)\s*/i, "")
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((parte) => parte[0]?.toLocaleUpperCase("es"))
                      .join("");
                    return (
                      <tr key={medico.id}>
                        <td>
                          <span className="medico-foto-avatar" aria-hidden="true">
                            {actual ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={actual.url} alt="" />
                            ) : (
                              iniciales
                            )}
                          </span>
                        </td>
                        <td>
                          <div className="medico-foto-fila-nombre">
                            <strong>{medico.nombre}</strong>
                          </div>
                        </td>
                        <td>{medico.especialidad.nombre}</td>
                        <td>
                          <div className="image-card-actions">
                            <label
                              className={`upload-button ${subiendo ? "is-disabled" : ""}`}
                            >
                              <UploadCloud aria-hidden="true" size={20} />
                              {subiendo
                                ? "Subiendo…"
                                : actual
                                  ? "Reemplazar"
                                  : "Subir foto"}
                              <input
                                type="file"
                                accept="image/*"
                                disabled={Boolean(ocupada)}
                                onChange={(event) => {
                                  void reemplazar(
                                    clave,
                                    event.target.files?.[0] ?? null,
                                    `Retrato de ${medico.nombre}`,
                                  );
                                  event.target.value = "";
                                }}
                              />
                            </label>
                            {actual ? (
                              <button
                                type="button"
                                className="ghost-button"
                                disabled={Boolean(ocupada)}
                                onClick={() => void quitar(clave)}
                              >
                                <Trash2 aria-hidden="true" size={19} /> Quitar
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </AdminShell>
  );
}
