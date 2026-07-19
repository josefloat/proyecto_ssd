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
import {
  subirArchivoCloudinary,
  type RecursoCloudinary,
} from "@/lib/cloudinary-upload";
import {
  CLAVE_POSTER_VIDEO,
  CLAVE_VIDEO_FONDO,
  claveEspecialidad,
  claveHero,
  MAX_FOTOS_HERO,
} from "@/lib/site-images";
import type { CatalogosAdmin, ImagenSitioAdmin } from "@/lib/personal-types";

// Claves fijas de las imágenes generales del sitio. La portada se gestiona
// aparte (admite varias fotos), los retratos usan la clave "medico:<id>" y
// las fotos del carrusel usan "especialidad-<slug>"; unas y otras se listan
// desde el catálogo real del backend, nunca hardcodeadas.
const IMAGENES_SITIO = [
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
  if (mensaje === "ARCHIVO_NO_VIDEO") return "El archivo elegido no es un vídeo.";
  if (mensaje === "ARCHIVO_MUY_GRANDE") {
    return "El archivo supera el límite (10 MB en imágenes, 80 MB en vídeo).";
  }
  if (detalle) return `Cloudinary rechazó la subida: ${detalle}`;
  return "No pudimos publicar el archivo. Intenta nuevamente.";
}

// Tarjeta genérica de subida: sirve para foto y para vídeo, con o sin recorte
// vertical, para no repetir el mismo bloque en cada sección. Vive fuera del
// componente de pantalla: si se declarara dentro, React la trataría como un
// tipo nuevo en cada render y desmontaría toda la rejilla en cada subida.
function TarjetaArchivo({
  titulo,
  descripcion,
  actual,
  subiendo,
  bloqueada,
  recurso = "image",
  retrato = false,
  onSubir,
  onQuitar,
}: {
  titulo: string;
  descripcion: string;
  actual: ImagenSitioAdmin | undefined;
  subiendo: boolean;
  bloqueada: boolean;
  recurso?: RecursoCloudinary;
  retrato?: boolean;
  onSubir: (archivo: File | null) => void;
  onQuitar: () => void;
}) {
  return (
    <article className={`image-card${retrato ? " is-retrato" : ""}`}>
      <div className="image-card-preview">
        {actual ? (
          recurso === "video" ? (
            <video src={actual.url} muted playsInline preload="metadata" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={actual.url} alt={actual.alt || titulo} />
          )
        ) : (
          <span>
            <ImageOff aria-hidden="true" size={19} /> Sin archivo — se usa el
            diseño por defecto
          </span>
        )}
      </div>
      <div className="image-card-body">
        <strong>{titulo}</strong>
        <small>{descripcion}</small>
        <div className="image-card-actions">
          <label className={`upload-button ${subiendo ? "is-disabled" : ""}`}>
            <UploadCloud aria-hidden="true" size={21} />
            {subiendo
              ? "Subiendo…"
              : actual
                ? "Reemplazar"
                : recurso === "video"
                  ? "Subir vídeo"
                  : "Subir imagen"}
            <input
              type="file"
              accept={recurso === "video" ? "video/*" : "image/*"}
              disabled={bloqueada}
              onChange={(event) => {
                onSubir(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
          </label>
          {actual ? (
            <button
              type="button"
              className="ghost-button"
              disabled={bloqueada}
              onClick={onQuitar}
            >
              <Trash2 aria-hidden="true" size={20} /> Quitar
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function AdminImagenesScreen() {
  const router = useRouter();
  const [imagenes, setImagenes] = useState<MapaImagenes | null>(null);
  const [catalogos, setCatalogos] = useState<CatalogosAdmin | null>(null);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [ocupada, setOcupada] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listarImagenesSitio(), obtenerCatalogosAdmin()])
      .then(([lista, catalogo]) => {
        setImagenes(Object.fromEntries(lista.map((item) => [item.clave, item])));
        setCatalogos(catalogo);
      })
      .catch((fallo: { status?: number }) => {
        if (fallo.status === 401 || fallo.status === 403) {
          router.replace("/personal/login");
        } else {
          setError("No pudimos cargar las imágenes del sitio.");
        }
      });
  }, [router]);

  async function reemplazar(
    clave: string,
    archivo: File | null,
    alt: string,
    recurso: RecursoCloudinary = "image",
  ) {
    if (!archivo || ocupada) return;
    setOcupada(clave);
    setError("");
    setExito("");
    try {
      const url = await subirArchivoCloudinary(archivo, recurso);
      const guardada = await guardarImagenAdmin(clave, { url, alt });
      setImagenes((mapa) => ({ ...(mapa ?? {}), [clave]: guardada }));
      setExito(
        "Publicado. El sitio público lo mostrará en unos minutos.",
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
      setExito("Quitado; el sitio vuelve a su diseño por defecto.");
    } catch {
      setError("No se pudo quitar el archivo.");
    } finally {
      setOcupada(null);
    }
  }

  // Enlaza una clave concreta con la tarjeta genérica: evita repetir el mismo
  // cableado de estado y de callbacks en las cuatro secciones.
  function propsDeTarjeta(
    clave: string,
    alt: string,
    recurso: RecursoCloudinary = "image",
  ) {
    const actual = imagenes?.[clave];
    return {
      actual,
      subiendo: ocupada === clave,
      bloqueada: Boolean(ocupada),
      recurso,
      onSubir: (archivo: File | null) =>
        void reemplazar(clave, archivo, actual?.alt || alt, recurso),
      onQuitar: () => void quitar(clave),
    };
  }

  const cargando = imagenes === null || catalogos === null;

  // Portada: se muestran las fotos ya publicadas más un hueco libre, para que
  // el ADMIN vaya añadiendo de una en una sin encontrarse seis tarjetas
  // vacías el primer día.
  const clavesPortada: string[] = [];
  for (let i = 0; i < MAX_FOTOS_HERO; i += 1) {
    const clave = claveHero(i);
    clavesPortada.push(clave);
    if (!imagenes?.[clave]) break;
  }

  return (
    <AdminShell
      actual="imagenes"
      titulo="Imágenes del sitio"
      subtitulo="Portada, fondos, fotos y retratos publicados mediante Cloudinary"
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
            Sube un archivo para reemplazar el actual; el cambio se publica sin
            redesplegar. Si quitas un archivo, el sitio usa su diseño por
            defecto.
          </p>

          <section aria-label="Portada de la home">
            <h2 className="admin-images-subtitle">Portada de la home</h2>
            <p className="admin-images-intro">
              El carrusel de la portada alterna estas fotos con las escenas
              ilustradas del diseño. La primera es la que se ve al entrar.
            </p>
            <div className="admin-images-grid">
              {clavesPortada.map((clave, indice) => (
                <TarjetaArchivo
                  key={clave}
                  titulo={`Foto ${indice + 1} de la portada`}
                  descripcion={
                    indice === 0
                      ? "Se ve al entrar al sitio y es la única obligatoria."
                      : "Aparece intercalada entre las escenas ilustradas."
                  }
                  {...propsDeTarjeta(
                    clave,
                    "Foto de la clínica Señal de Vida en Ayacucho",
                  )}
                />
              ))}
            </div>
          </section>

          <section aria-label="Fondo en vídeo de la home">
            <h2 className="admin-images-subtitle">Fondo en vídeo</h2>
            <p className="admin-images-intro">
              Opcional. Si subes un vídeo, la home lo reproduce en silencio y
              en bucle detrás del contenido, y las secciones pasan a un acabado
              translúcido para que el texto siga leyéndose. Usa un clip corto y
              sin texto; quien haya pedido movimiento reducido verá la imagen
              de reserva en su lugar.
            </p>
            <div className="admin-images-grid">
              <TarjetaArchivo
                titulo="Vídeo de fondo"
                descripcion="Máximo 80 MB. Se reproduce sin sonido y en bucle."
                {...propsDeTarjeta(CLAVE_VIDEO_FONDO, "", "video")}
              />
              <TarjetaArchivo
                titulo="Imagen de reserva del vídeo"
                descripcion="Se muestra mientras carga el vídeo y con movimiento reducido."
                {...propsDeTarjeta(CLAVE_POSTER_VIDEO, "")}
              />
            </div>
          </section>

          <section aria-label="Fotos del carrusel de especialidades">
            <h2 className="admin-images-subtitle">Carrusel de especialidades</h2>
            <p className="admin-images-intro">
              Una foto vertical por especialidad para el carrusel de la home.
              Sin foto, la tarjeta muestra su icono ilustrado.
            </p>
            <div className="admin-images-grid">
              {catalogos?.especialidades.map((especialidad) => (
                <TarjetaArchivo
                  key={especialidad.id}
                  titulo={especialidad.nombre}
                  descripcion="Foto vertical de la tarjeta del carrusel."
                  retrato
                  {...propsDeTarjeta(claveEspecialidad(especialidad.nombre), "")}
                />
              ))}
            </div>
          </section>

          <section aria-label="Imágenes generales del sitio">
            <h2 className="admin-images-subtitle">Otras imágenes del sitio</h2>
            <div className="admin-images-grid">
              {IMAGENES_SITIO.map(({ clave, titulo, descripcion }) => (
                <TarjetaArchivo
                  key={clave}
                  titulo={titulo}
                  descripcion={descripcion}
                  {...propsDeTarjeta(clave, titulo)}
                />
              ))}
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
                  {catalogos?.medicos.map((medico) => {
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
