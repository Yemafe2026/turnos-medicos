"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../supabase";

const sedes = ["Todas", "Sede Cipolletti", "Sede Neuquén", "Sede Plaza Huincul"];
const meses = [
    { value: "Todos", label: "Todos" },
    { value: "01", label: "Enero" },
    { value: "02", label: "Febrero" },
    { value: "03", label: "Marzo" },
    { value: "04", label: "Abril" },
    { value: "05", label: "Mayo" },
    { value: "06", label: "Junio" },
    { value: "07", label: "Julio" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Septiembre" },
    { value: "10", label: "Octubre" },
    { value: "11", label: "Noviembre" },
    { value: "12", label: "Diciembre" },
];

function formatearImporte(valor) {
    return `$${Number(valor || 0).toLocaleString("es-AR")}`;
}

function obtenerAnio(fecha) {
    return String(fecha || "").slice(0, 4);
}

function obtenerMes(fecha) {
    return String(fecha || "").slice(5, 7);
}

function resumenVacio() {
    return {
        certificados: 0,
        facturacion: 0,
        prereservasCaidas: 0,
        ausentes: 0,
        ausentesReprogramadas: 0,
        reprogramadasAusentes: 0,
    };
}

export default function AdminDashboardPage() {
    const router = useRouter();

    const [perfilAdmin, setPerfilAdmin] = useState(null);
    const [turnos, setTurnos] = useState([]);
    const [cargando, setCargando] = useState(true);

    const [filtroAnio, setFiltroAnio] = useState(String(new Date().getFullYear()));
    const [filtroMes, setFiltroMes] = useState("Todos");
    const [filtroSede, setFiltroSede] = useState("Todas");

    const rolAdmin = perfilAdmin?.rol || "consulta";
    const usuarioLimitadoPorSede =
        rolAdmin === "operador" || rolAdmin === "admisionista";

    const cargarDatos = async () => {
        setCargando(true);

        const { data: sessionData } = await supabase.auth.getSession();

        if (!sessionData.session) {
            router.push("/admin/login");
            return;
        }

        const { data: perfil, error: perfilError } = await supabase
            .from("perfiles_admin")
            .select("rol, activo, email, locacion")
            .eq("id", sessionData.session.user.id)
            .single();

        if (perfilError || !perfil || perfil.activo !== true) {
            await supabase.auth.signOut();
            router.push("/admin/login");
            return;
        }

        setPerfilAdmin(perfil);

        const { data } = await supabase
            .from("turnos")
            .select("*")
            .order("fecha", { ascending: true });

        setTurnos(data || []);
        setCargando(false);
    };

    useEffect(() => {
        cargarDatos();
    }, []);

    const aniosDisponibles = useMemo(() => {
        const anios = [...new Set(turnos.map((t) => obtenerAnio(t.fecha)).filter(Boolean))];
        return anios.sort((a, b) => b.localeCompare(a));
    }, [turnos]);

    const turnosFiltrados = useMemo(() => {
        return turnos.filter((t) => {
            const anio = obtenerAnio(t.fecha);
            const mes = obtenerMes(t.fecha);

            const coincideAnio = filtroAnio === "Todos" || anio === filtroAnio;
            const coincideMes = filtroMes === "Todos" || mes === filtroMes;

            const coincideSede = usuarioLimitadoPorSede
                ? t.locacion === perfilAdmin?.locacion
                : filtroSede === "Todas" || t.locacion === filtroSede;

            return coincideAnio && coincideMes && coincideSede;
        });
    }, [turnos, filtroAnio, filtroMes, filtroSede, perfilAdmin, usuarioLimitadoPorSede]);

    const resumenGeneral = useMemo(() => {
        return turnosFiltrados.reduce((acc, t) => {
            const estado = t.estado || "";

            if (estado === "Realizado") acc.certificados += 1;

            if (t.pagado === true) {
                acc.facturacion += Number(t.importe_servicio || 0);
            }

            if (estado === "No Confirmado" || estado === "Cancelado") {
                acc.prereservasCaidas += 1;
            }

            if (estado === "Ausente") {
                acc.ausentes += 1;
            }

            if (t.es_reprogramacion === true) {
                acc.ausentesReprogramadas += 1;
            }

            if (t.es_reprogramacion === true && estado === "Ausente") {
                acc.reprogramadasAusentes += 1;
            }

            return acc;
        }, resumenVacio());
    }, [turnosFiltrados]);

    const resumenPorSede = useMemo(() => {
        const mapa = {};

        turnosFiltrados.forEach((t) => {
            const sede = t.locacion || "Sin sede";
            const estado = t.estado || "";

            if (!mapa[sede]) mapa[sede] = resumenVacio();

            if (estado === "Realizado") mapa[sede].certificados += 1;

            if (t.pagado === true) {
                mapa[sede].facturacion += Number(t.importe_servicio || 0);
            }

            if (estado === "No Confirmado" || estado === "Cancelado") {
                mapa[sede].prereservasCaidas += 1;
            }

            if (estado === "Ausente") {
                mapa[sede].ausentes += 1;
            }

            if (t.es_reprogramacion === true) {
                mapa[sede].ausentesReprogramadas += 1;
            }

            if (t.es_reprogramacion === true && estado === "Ausente") {
                mapa[sede].reprogramadasAusentes += 1;
            }
        });

        return Object.entries(mapa).map(([sede, datos]) => ({ sede, ...datos }));
    }, [turnosFiltrados]);

    return (
        <main className="min-h-screen bg-slate-100 p-4">
            <div className="w-full mx-auto space-y-4">
                <div className="bg-white p-4 rounded-2xl shadow flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold">Tablero de Mando</h1>
                        <p className="text-sm text-slate-500">
                            Indicadores por sede, mes y año
                        </p>
                        <p className="text-xs text-slate-400">
                            Rol activo: <span className="font-semibold">{rolAdmin}</span>
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={cargarDatos}
                            className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-50"
                        >
                            Actualizar
                        </button>

                        <button
                            onClick={() => router.push("/admin")}
                            className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm"
                        >
                            Volver al Admin
                        </button>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl shadow grid md:grid-cols-4 gap-3">
                    <div>
                        <label className="text-xs text-slate-500">Año</label>
                        <select
                            value={filtroAnio}
                            onChange={(e) => setFiltroAnio(e.target.value)}
                            className="border p-2 rounded-xl bg-white w-full"
                        >
                            <option value="Todos">Todos</option>
                            {aniosDisponibles.map((anio) => (
                                <option key={anio} value={anio}>
                                    {anio}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs text-slate-500">Mes</label>
                        <select
                            value={filtroMes}
                            onChange={(e) => setFiltroMes(e.target.value)}
                            className="border p-2 rounded-xl bg-white w-full"
                        >
                            {meses.map((m) => (
                                <option key={m.value} value={m.value}>
                                    {m.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs text-slate-500">Sede</label>
                        {usuarioLimitadoPorSede ? (
                            <div className="border p-2 rounded-xl bg-slate-100">
                                {perfilAdmin?.locacion || "-"}
                            </div>
                        ) : (
                            <select
                                value={filtroSede}
                                onChange={(e) => setFiltroSede(e.target.value)}
                                className="border p-2 rounded-xl bg-white w-full"
                            >
                                {sedes.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="flex items-end">
                        <div className="text-sm text-slate-500">
                            Registros analizados:{" "}
                            <span className="font-bold text-slate-900">
                                {turnosFiltrados.length}
                            </span>
                        </div>
                    </div>
                </div>

                {cargando ? (
                    <div className="bg-white p-6 rounded-2xl shadow text-sm">
                        Cargando indicadores...
                    </div>
                ) : (
                    <>
                        <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-3">
                            <div className="bg-white p-4 rounded-2xl shadow">
                                <p className="text-xs text-slate-500">Certificados emitidos</p>
                                <p className="text-3xl font-bold">{resumenGeneral.certificados}</p>
                            </div>

                            <div className="bg-white p-4 rounded-2xl shadow">
                                <p className="text-xs text-slate-500">Facturación</p>
                                <p className="text-2xl font-bold">
                                    {formatearImporte(resumenGeneral.facturacion)}
                                </p>
                            </div>

                            <div className="bg-white p-4 rounded-2xl shadow">
                                <p className="text-xs text-slate-500">Pre-reservas caídas</p>
                                <p className="text-3xl font-bold text-amber-700">
                                    {resumenGeneral.prereservasCaidas}
                                </p>
                            </div>

                            <div className="bg-white p-4 rounded-2xl shadow">
                                <p className="text-xs text-slate-500">Ausentes</p>
                                <p className="text-3xl font-bold text-red-700">
                                    {resumenGeneral.ausentes}
                                </p>
                            </div>

                            <div className="bg-white p-4 rounded-2xl shadow">
                                <p className="text-xs text-slate-500">Ausentes reprogramadas</p>
                                <p className="text-3xl font-bold text-purple-700">
                                    {resumenGeneral.ausentesReprogramadas}
                                </p>
                            </div>

                            <div className="bg-white p-4 rounded-2xl shadow">
                                <p className="text-xs text-slate-500">Reprogramadas ausentes</p>
                                <p className="text-3xl font-bold text-slate-800">
                                    {resumenGeneral.reprogramadasAusentes}
                                </p>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl shadow">
                            <h2 className="font-semibold mb-3">Resumen por sede</h2>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-slate-50 text-left">
                                            <th className="p-3">Sede</th>
                                            <th className="p-3">Certificados</th>
                                            <th className="p-3">Facturación</th>
                                            <th className="p-3">Caídas</th>
                                            <th className="p-3">Ausentes</th>
                                            <th className="p-3">Ausentes reprogramadas</th>
                                            <th className="p-3">Reprogramadas ausentes</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {resumenPorSede.map((fila) => (
                                            <tr key={fila.sede} className="border-b">
                                                <td className="p-3 font-semibold">{fila.sede}</td>
                                                <td className="p-3">{fila.certificados}</td>
                                                <td className="p-3 font-semibold">
                                                    {formatearImporte(fila.facturacion)}
                                                </td>
                                                <td className="p-3">{fila.prereservasCaidas}</td>
                                                <td className="p-3">{fila.ausentes}</td>
                                                <td className="p-3">{fila.ausentesReprogramadas}</td>
                                                <td className="p-3">{fila.reprogramadasAusentes}</td>
                                            </tr>
                                        ))}

                                        {resumenPorSede.length === 0 && (
                                            <tr>
                                                <td colSpan="7" className="p-4 text-slate-500">
                                                    No hay datos para los filtros seleccionados.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}