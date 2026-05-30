"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../supabase";

const roles = ["super_admin", "supervisor", "admisionista", "operador"];

const locaciones = [
    "Sede Cipolletti",
    "Sede Neuquén",
    "Sede Plaza Huincul",
];

function requiereLocacion(rol) {
    return rol === "admisionista" || rol === "operador";
}

export default function AdminUsuariosPage() {
    const router = useRouter();

    const [perfilActual, setPerfilActual] = useState(null);
    const [usuarios, setUsuarios] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [mensaje, setMensaje] = useState("");

    const [nuevo, setNuevo] = useState({
        id: "",
        email: "",
        rol: "operador",
        locacion: "Sede Cipolletti",
    });

    const cargar = async () => {
        setCargando(true);
        setMensaje("");

        const { data: sessionData } = await supabase.auth.getSession();

        if (!sessionData.session) {
            router.push("/admin/login");
            return;
        }

        const userId = sessionData.session.user.id;

        const { data: perfil, error: perfilError } = await supabase
            .from("perfiles_admin")
            .select("*")
            .eq("id", userId)
            .single();

        if (
            perfilError ||
            !perfil ||
            perfil.rol !== "super_admin" ||
            !perfil.activo
        ) {
            router.push("/admin");
            return;
        }

        setPerfilActual(perfil);

        const { data, error } = await supabase
            .from("perfiles_admin")
            .select("*")
            .order("email", { ascending: true });

        if (error) {
            setMensaje("No se pudieron cargar los usuarios.");
            setCargando(false);
            return;
        }

        setUsuarios(data || []);
        setCargando(false);
    };

    useEffect(() => {
        cargar();
    }, []);

    const agregarUsuario = async () => {
        setMensaje("");

        if (!nuevo.id.trim() || !nuevo.email.trim() || !nuevo.rol) {
            setMensaje("Complete UID, email y rol.");
            return;
        }

        if (requiereLocacion(nuevo.rol) && !nuevo.locacion) {
            setMensaje("Admisionistas y operadores deben tener una sede asignada.");
            return;
        }

        const { error } = await supabase.from("perfiles_admin").insert([
            {
                id: nuevo.id.trim(),
                email: nuevo.email.trim(),
                rol: nuevo.rol,
                activo: true,
                locacion: requiereLocacion(nuevo.rol) ? nuevo.locacion : null,
            },
        ]);

        if (error) {
            setMensaje(`No se pudo agregar el usuario: ${error.message}`);
            return;
        }

        setNuevo({
            id: "",
            email: "",
            rol: "operador",
            locacion: "Sede Cipolletti",
        });

        cargar();
    };

    const cambiarRol = async (usuario, rol) => {
        setMensaje("");

        const nuevaLocacion = requiereLocacion(rol)
            ? usuario.locacion || "Sede Cipolletti"
            : null;

        const { error } = await supabase
            .from("perfiles_admin")
            .update({
                rol,
                locacion: nuevaLocacion,
            })
            .eq("id", usuario.id);

        if (error) {
            setMensaje(`No se pudo cambiar el rol: ${error.message}`);
            return;
        }

        cargar();
    };

    const cambiarLocacion = async (usuario, locacion) => {
        setMensaje("");

        if (!requiereLocacion(usuario.rol)) {
            setMensaje("Este rol no requiere sede asignada.");
            return;
        }

        const { error } = await supabase
            .from("perfiles_admin")
            .update({ locacion })
            .eq("id", usuario.id);

        if (error) {
            setMensaje(`No se pudo cambiar la sede: ${error.message}`);
            return;
        }

        cargar();
    };

    const cambiarActivo = async (usuario) => {
        setMensaje("");

        if (usuario.id === perfilActual?.id && usuario.activo) {
            setMensaje("No puede desactivar su propio usuario.");
            return;
        }

        const { error } = await supabase
            .from("perfiles_admin")
            .update({ activo: !usuario.activo })
            .eq("id", usuario.id);

        if (error) {
            setMensaje(`No se pudo actualizar el estado: ${error.message}`);
            return;
        }

        cargar();
    };

    return (
        <main className="min-h-screen bg-slate-100 p-4">
            <div className="max-w-6xl mx-auto space-y-4">
                <div className="bg-white p-4 rounded-2xl shadow flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold">Usuarios Administrativos</h1>
                        <p className="text-sm text-slate-500">
                            Gestión de roles, sedes y accesos al panel
                        </p>
                    </div>

                    <button
                        onClick={() => router.push("/admin")}
                        className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-50"
                    >
                        Volver al Admin
                    </button>
                </div>

                {mensaje && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-sm">
                        {mensaje}
                    </div>
                )}

                <div className="bg-white p-4 rounded-2xl shadow space-y-4">
                    <h2 className="font-semibold">Agregar perfil administrativo</h2>

                    <div className="grid md:grid-cols-5 gap-3">
                        <input
                            className="border p-2 rounded-xl"
                            placeholder="User UID de Supabase"
                            value={nuevo.id}
                            onChange={(e) => setNuevo({ ...nuevo, id: e.target.value })}
                        />

                        <input
                            className="border p-2 rounded-xl"
                            placeholder="Email"
                            value={nuevo.email}
                            onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })}
                        />

                        <select
                            className="border p-2 rounded-xl bg-white"
                            value={nuevo.rol}
                            onChange={(e) =>
                                setNuevo({
                                    ...nuevo,
                                    rol: e.target.value,
                                    locacion: requiereLocacion(e.target.value)
                                        ? nuevo.locacion || "Sede Cipolletti"
                                        : "",
                                })
                            }
                        >
                            {roles.map((rol) => (
                                <option key={rol} value={rol}>
                                    {rol}
                                </option>
                            ))}
                        </select>

                        <select
                            className="border p-2 rounded-xl bg-white"
                            value={nuevo.locacion}
                            disabled={!requiereLocacion(nuevo.rol)}
                            onChange={(e) =>
                                setNuevo({ ...nuevo, locacion: e.target.value })
                            }
                        >
                            {!requiereLocacion(nuevo.rol) && (
                                <option value="">Todas las sedes</option>
                            )}

                            {locaciones.map((locacion) => (
                                <option key={locacion} value={locacion}>
                                    {locacion}
                                </option>
                            ))}
                        </select>

                        <button
                            onClick={agregarUsuario}
                            className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2"
                        >
                            Agregar
                        </button>
                    </div>

                    <p className="text-xs text-slate-500">
                        Primero cree el usuario en Supabase Authentication, luego copie su
                        User UID y agréguelo aquí.
                    </p>
                </div>

                <div className="bg-white p-4 rounded-2xl shadow">
                    <h2 className="font-semibold mb-3">Usuarios cargados</h2>

                    {cargando ? (
                        <p className="text-sm text-slate-500">Cargando...</p>
                    ) : (
                        <div className="space-y-3">
                            {usuarios.map((u) => (
                                <div
                                    key={u.id}
                                    className="border rounded-2xl p-4 grid md:grid-cols-6 gap-3 items-center"
                                >
                                    <div className="md:col-span-2">
                                        <p className="font-semibold">{u.email}</p>
                                        <p className="text-xs text-slate-500 break-all">{u.id}</p>
                                    </div>

                                    <select
                                        className="border p-2 rounded-xl bg-white"
                                        value={u.rol}
                                        onChange={(e) => cambiarRol(u, e.target.value)}
                                        disabled={u.id === perfilActual?.id}
                                    >
                                        {roles.map((rol) => (
                                            <option key={rol} value={rol}>
                                                {rol}
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        className="border p-2 rounded-xl bg-white"
                                        value={u.locacion || ""}
                                        disabled={
                                            !requiereLocacion(u.rol) || u.id === perfilActual?.id
                                        }
                                        onChange={(e) => cambiarLocacion(u, e.target.value)}
                                    >
                                        {!requiereLocacion(u.rol) && (
                                            <option value="">Todas las sedes</option>
                                        )}

                                        {locaciones.map((locacion) => (
                                            <option key={locacion} value={locacion}>
                                                {locacion}
                                            </option>
                                        ))}
                                    </select>

                                    <div>
                                        {u.activo ? (
                                            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-semibold">
                                                Activo
                                            </span>
                                        ) : (
                                            <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-semibold">
                                                Inactivo
                                            </span>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => cambiarActivo(u)}
                                        disabled={u.id === perfilActual?.id}
                                        className={`rounded-xl px-4 py-2 text-sm ${u.id === perfilActual?.id
                                                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                                                : u.activo
                                                    ? "bg-red-600 hover:bg-red-700 text-white"
                                                    : "bg-green-600 hover:bg-green-700 text-white"
                                            }`}
                                    >
                                        {u.activo ? "Desactivar" : "Activar"}
                                    </button>
                                </div>
                            ))}

                            {usuarios.length === 0 && (
                                <p className="text-sm text-slate-500">
                                    No hay usuarios administrativos cargados.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}