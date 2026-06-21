"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../supabase";

const SEDES_OPERATIVAS = [
    "Sede Cipolletti",
    "Sede Neuquén",
    "Sede Plaza Huincul",
];

const sedes = ["Todas", ...SEDES_OPERATIVAS];

const ORDEN_SEDES = SEDES_OPERATIVAS.reduce((acc, sede, index) => {
    acc[sede] = index + 1;
    return acc;
}, {});

const indicadoresHistoricos = [
    { value: "certificados", label: "Certificados emitidos" },
    { value: "facturacion", label: "Facturación" },
    { value: "ausentes", label: "Ausentes" },
    { value: "porcentajeAusentes", label: "% Ausentes" },
    { value: "caidas", label: "Caídas" },
    { value: "porcentajeCaidas", label: "% Caídas" },
];

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
        confirmados: 0,
        certificados: 0,
        facturacion: 0,
        prereservasCaidas: 0,
        ausentes: 0,
        ausentesReprogramadas: 0,
        reprogramadasAusentes: 0,
    };
}
function depurarTurnosParaIndicadores(turnos) {
    const prioridadEstado = {
        Realizado: 5,
        Confirmado: 4,
        Ausente: 3,
        "Pendiente de pago": 2,
        "No Confirmado": 1,
        Cancelado: 1,
    };

    const mapa = {};

    turnos.forEach((t) => {
        const clave = `${t.dni || ""}-${t.fecha || ""}-${t.locacion || ""}`;
        const actual = mapa[clave];

        if (!actual) {
            mapa[clave] = t;
            return;
        }

        const prioridadActual = prioridadEstado[actual.estado] || 0;
        const prioridadNuevo = prioridadEstado[t.estado] || 0;

        if (prioridadNuevo > prioridadActual) {
            mapa[clave] = t;
        }
    });

    return Object.values(mapa);
}
function porcentaje(numerador, denominador) {
    if (!denominador || denominador <= 0) return 0;
    return (numerador / denominador) * 100;
}

function formatearPorcentaje(valor) {
    return `${Number(valor || 0).toFixed(1)}%`;
}
function esDiaHabil(fecha) {
    const dia = fecha.getDay();
    return dia !== 0 && dia !== 6;
}

function contarDiasHabilesDesdeHasta(fechaInicio, fechaFin) {
    if (!fechaInicio || !fechaFin) return 1;

    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    inicio.setHours(0, 0, 0, 0);
    fin.setHours(0, 0, 0, 0);

    let contador = 0;
    const fechaActual = new Date(inicio);

    while (fechaActual <= fin) {
        if (esDiaHabil(fechaActual)) {
            contador += 1;
        }

        fechaActual.setDate(fechaActual.getDate() + 1);
    }

    return Math.max(contador, 1);
}

function obtenerUltimoDiaDelMes(anio, mes) {
    return new Date(Number(anio), Number(mes), 0);

}
function contarDiasHabilesDelMes(anio, mes) {
    const inicio = new Date(Number(anio), Number(mes) - 1, 1);
    const fin = obtenerUltimoDiaDelMes(anio, mes);

    return contarDiasHabilesDesdeHasta(inicio, fin);
}

export default function AdminDashboardPage() {
    const router = useRouter();

    const [perfilAdmin, setPerfilAdmin] = useState(null);
    const [turnos, setTurnos] = useState([]);
    const [cargando, setCargando] = useState(true);

    const [filtroAnio, setFiltroAnio] = useState(String(new Date().getFullYear()));
    const [filtroMes, setFiltroMes] = useState("Todos");
    const [filtroSede, setFiltroSede] = useState("Todas");
    const [mostrarHistorico, setMostrarHistorico] = useState(false);
    const [historicoAnio, setHistoricoAnio] = useState(String(new Date().getFullYear()));
    const [historicoMes, setHistoricoMes] = useState("Todos");
    const [historicoSede, setHistoricoSede] = useState("Todas");
    const [historicoIndicador, setHistoricoIndicador] = useState("certificados");

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

    const turnosParaIndicadores = useMemo(() => {
        return depurarTurnosParaIndicadores(turnosFiltrados);
    }, [turnosFiltrados]);

    const resumenGeneral = useMemo(() => {
        return turnosParaIndicadores.reduce((acc, t) => {
            const estado = t.estado || "";

            if (estado === "Confirmado") acc.confirmados += 1;

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
    }, [turnosParaIndicadores]);
    const diasTranscurridos = useMemo(() => {
        if (turnosFiltrados.length === 0) return 1;

        const fechasValidas = turnosFiltrados
            .map((t) => t.fecha)
            .filter(Boolean)
            .sort();

        if (fechasValidas.length === 0) return 1;

        const primeraFecha = fechasValidas[0];

        const hoy = new Date();
        const anioActual = String(hoy.getFullYear());
        const mesActual = String(hoy.getMonth() + 1).padStart(2, "0");

        let fechaFin = hoy;

        if (
            filtroAnio !== "Todos" &&
            filtroMes !== "Todos" &&
            !(filtroAnio === anioActual && filtroMes === mesActual)
        ) {
            fechaFin = obtenerUltimoDiaDelMes(filtroAnio, filtroMes);
        }

        return contarDiasHabilesDesdeHasta(primeraFecha, fechaFin);
    }, [turnosFiltrados, filtroAnio, filtroMes]);

    const indicadoresGenerales = useMemo(() => {
        const emitidos = resumenGeneral.certificados;
        const confirmados = resumenGeneral.confirmados;

        return {
            certificadosPorDia:
                diasTranscurridos > 0
                    ? emitidos / diasTranscurridos
                    : 0,

            tasaCaidos: porcentaje(
                resumenGeneral.prereservasCaidas,
                confirmados +
                emitidos +
                resumenGeneral.prereservasCaidas +
                resumenGeneral.ausentes
            ),

            tasaAusentes: porcentaje(
                resumenGeneral.ausentes,
                confirmados + emitidos + resumenGeneral.ausentes
            ),

            tasaReprogramacionAusentes: porcentaje(
                resumenGeneral.ausentesReprogramadas,
                resumenGeneral.ausentes
            ),
        };
    }, [resumenGeneral, diasTranscurridos]);

    const resumenPorSede = useMemo(() => {
        const mapa = {};

        turnosParaIndicadores.forEach((t) => {
            const sede = t.locacion || "Sin sede";
            const estado = t.estado || "";

            if (!mapa[sede]) mapa[sede] = resumenVacio();

            if (estado === "Confirmado") mapa[sede].confirmados += 1;

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

        const ordenSedes = ORDEN_SEDES;

        return Object.entries(mapa)
            .map(([sede, datos]) => ({ sede, ...datos }))
            .sort((a, b) => {
                return (
                    (ordenSedes[a.sede] || 999) -
                    (ordenSedes[b.sede] || 999)
                );
            });
    }, [turnosParaIndicadores]);

    const resumenMensual = useMemo(() => {
        const mapa = {};

        turnosParaIndicadores.forEach((t) => {
            const fecha = t.fecha || "";
            const anio = obtenerAnio(fecha);
            const mes = obtenerMes(fecha);
            const sede = t.locacion || "Sin sede";

            if (!anio || !mes) return;

            const clave = `${anio}-${mes}-${sede}`;
            const estado = t.estado || "";

            if (!mapa[clave]) {
                mapa[clave] = {
                    periodo: `${anio}-${mes}`,
                    anio,
                    mes,
                    sede,
                    confirmados: 0,
                    certificados: 0,
                    facturacion: 0,
                    caidas: 0,
                    ausentes: 0,
                    ausentesReprogramadas: 0,
                    reprogramadasAusentes: 0,
                };
            }

            if (estado === "Confirmado") mapa[clave].confirmados += 1;
            if (estado === "Realizado") mapa[clave].certificados += 1;

            if (t.pagado === true) {
                mapa[clave].facturacion += Number(t.importe_servicio || 0);
            }

            if (estado === "No Confirmado" || estado === "Cancelado") {
                mapa[clave].caidas += 1;
            }

            if (estado === "Ausente") {
                mapa[clave].ausentes += 1;
            }

            if (t.es_reprogramacion === true) {
                mapa[clave].ausentesReprogramadas += 1;
            }

            if (t.es_reprogramacion === true && estado === "Ausente") {
                mapa[clave].reprogramadasAusentes += 1;
            }
        });

        const ordenSedes = ORDEN_SEDES;

        return Object.values(mapa).sort((a, b) => {
            const comparacionPeriodo = a.periodo.localeCompare(b.periodo);

            if (comparacionPeriodo !== 0) {
                return comparacionPeriodo;
            }

            return (
                (ordenSedes[a.sede] || 999) -
                (ordenSedes[b.sede] || 999)
            );
        });
    }, [turnosParaIndicadores]);

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
                            <p>
                                Registros analizados:{" "}
                                <span className="font-bold text-slate-900">
                                    {turnosFiltrados.length}
                                </span>
                            </p>

                            <p>
                                Casos únicos para indicadores:{" "}
                                <span className="font-bold text-green-700">
                                    {turnosParaIndicadores.length}
                                </span>
                            </p>

                            <p className="text-xs text-slate-400 mt-1">
                                Dashboard operativo filtrado por período y sede seleccionados
                            </p>
                        </div>
                    </div>
                </div>
                {cargando ? (
                    <div className="bg-white p-6 rounded-2xl shadow text-sm">
                        Cargando indicadores...
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                            <div className="bg-white p-4 rounded-2xl shadow">
                                <p className="text-xs text-slate-500">Confirmados</p>
                                <p className="text-3xl font-bold text-green-700">
                                    {resumenGeneral.confirmados}
                                </p>
                            </div>

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
                        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">

                            <div className="bg-white p-4 rounded-2xl shadow">
                                <p className="text-xs text-slate-500">
                                    Certificados / día
                                </p>

                                <p className="text-3xl font-bold text-blue-700">
                                    {indicadoresGenerales.certificadosPorDia.toFixed(2)}
                                </p>

                                <p className="text-xs text-slate-400 mt-2">
                                    Calculado sobre {diasTranscurridos} días hábiles
                                </p>
                            </div>

                            <div className="bg-white p-4 rounded-2xl shadow">
                                <p className="text-xs text-slate-500">
                                    Tasa de caídos
                                </p>

                                <p className="text-3xl font-bold text-amber-700">
                                    {formatearPorcentaje(
                                        indicadoresGenerales.tasaCaidos
                                    )}
                                </p>
                            </div>

                            <div className="bg-white p-4 rounded-2xl shadow">
                                <p className="text-xs text-slate-500">
                                    Tasa de ausentes
                                </p>

                                <p className="text-3xl font-bold text-red-700">
                                    {formatearPorcentaje(
                                        indicadoresGenerales.tasaAusentes
                                    )}
                                </p>
                            </div>

                            <div className="bg-white p-4 rounded-2xl shadow">
                                <p className="text-xs text-slate-500">
                                    Recuperación de ausentes
                                </p>

                                <p className="text-3xl font-bold text-purple-700">
                                    {formatearPorcentaje(
                                        indicadoresGenerales.tasaReprogramacionAusentes
                                    )}
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
                                            <th className="p-3">Confirmados</th>
                                            <th className="p-3">Certificados</th>
                                            <th className="p-3">Facturación</th>
                                            <th className="p-3">Caídas</th>
                                            <th className="p-3">Ausentes</th>
                                            <th className="p-3">Ausentes reprogramadas</th>
                                            <th className="p-3">Reprogramadas ausentes</th>
                                            <th className="p-3">Cert./día</th>
                                            <th className="p-3">% Caídas</th>
                                            <th className="p-3">% Ausentes</th>
                                            <th className="p-3">% Reprog. ausentes</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {resumenPorSede.map((fila) => (
                                            <tr key={fila.sede} className="border-b">
                                                <td className="p-3 font-semibold">{fila.sede}</td>
                                                <td className="p-3">{fila.confirmados}</td>
                                                <td className="p-3">{fila.certificados}</td>
                                                <td className="p-3 font-semibold">
                                                    {formatearImporte(fila.facturacion)}
                                                </td>
                                                <td className="p-3">{fila.prereservasCaidas}</td>
                                                <td className="p-3">{fila.ausentes}</td>
                                                <td className="p-3">{fila.ausentesReprogramadas}</td>
                                                <td className="p-3">{fila.reprogramadasAusentes}</td>

                                                <td className="p-3">
                                                    {(fila.certificados / diasTranscurridos).toFixed(2)}
                                                </td>

                                                <td className="p-3">
                                                    {formatearPorcentaje(
                                                        porcentaje(
                                                            fila.prereservasCaidas,
                                                            fila.confirmados +
                                                            fila.certificados +
                                                            fila.prereservasCaidas +
                                                            fila.ausentes
                                                        )
                                                    )}
                                                </td>

                                                <td className="p-3">
                                                    {formatearPorcentaje(
                                                        porcentaje(
                                                            fila.ausentes,
                                                            fila.confirmados + fila.certificados + fila.ausentes
                                                        )
                                                    )}
                                                </td>

                                                <td className="p-3">
                                                    {formatearPorcentaje(
                                                        porcentaje(
                                                            fila.ausentesReprogramadas,
                                                            fila.ausentes
                                                        )
                                                    )}
                                                </td>
                                            </tr>
                                        ))}

                                        {resumenPorSede.length === 0 && (
                                            <tr>
                                                <td colSpan="12" className="p-4 text-slate-500">
                                                    No hay datos para los filtros seleccionados.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-2xl shadow">
                            <button
                                onClick={() => setMostrarHistorico(!mostrarHistorico)}
                                className="w-full flex justify-between items-center text-left"
                            >
                                <span className="font-semibold">
                                    Análisis histórico
                                </span>

                                <span className="text-sm text-slate-500">
                                    {mostrarHistorico ? "Ocultar" : "Mostrar"}
                                </span>
                            </button>
                        </div>
                        {mostrarHistorico && (
                            <div className="bg-white p-4 rounded-2xl shadow">
                                <h2 className="font-semibold mb-3">Resumen mensual</h2>
                                <div className="grid md:grid-cols-4 gap-3 mb-4">

                                    <select
                                        value={historicoAnio}
                                        onChange={(e) => setHistoricoAnio(e.target.value)}
                                        className="border p-2 rounded-xl bg-white"
                                    >
                                        {aniosDisponibles.map((anio) => (
                                            <option key={anio} value={anio}>
                                                {anio}
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        value={historicoMes}
                                        onChange={(e) => setHistoricoMes(e.target.value)}
                                        className="border p-2 rounded-xl bg-white"
                                    >
                                        {meses.map((mes) => (
                                            <option key={mes.value} value={mes.value}>
                                                {mes.label}
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        value={historicoSede}
                                        onChange={(e) => setHistoricoSede(e.target.value)}
                                        className="border p-2 rounded-xl bg-white"
                                    >
                                        {sedes.map((sede) => (
                                            <option key={sede} value={sede}>
                                                {sede}
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        value={historicoIndicador}
                                        onChange={(e) => setHistoricoIndicador(e.target.value)}
                                        className="border p-2 rounded-xl bg-white"
                                    >
                                        {indicadoresHistoricos.map((indicador) => (
                                            <option
                                                key={indicador.value}
                                                value={indicador.value}
                                            >
                                                {indicador.label}
                                            </option>
                                        ))}
                                    </select>

                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b bg-slate-50 text-left">
                                                <th className="p-3">Mes</th>
                                                <th className="p-3">Sede</th>
                                                <th className="p-3">Confirmados</th>
                                                <th className="p-3">Certificados</th>
                                                <th className="p-3">Facturación</th>
                                                <th className="p-3">Caídas</th>
                                                <th className="p-3">Ausentes</th>
                                                <th className="p-3">Ausentes reprogramadas</th>
                                                <th className="p-3">Reprogramadas ausentes</th>
                                                <th className="p-3">Cert./día</th>
                                                <th className="p-3">% Caídas</th>
                                                <th className="p-3">% Ausentes</th>
                                                <th className="p-3">% Reprog. ausentes</th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {resumenMensual
                                                .filter((fila) => {
                                                    const coincideAnio = fila.anio === historicoAnio;

                                                    const coincideMes =
                                                        historicoMes === "Todos" ||
                                                        fila.mes === historicoMes;

                                                    const coincideSede =
                                                        historicoSede === "Todas" ||
                                                        fila.sede === historicoSede;

                                                    return coincideAnio && coincideMes && coincideSede;
                                                })
                                                .map((fila) => (
                                                    <tr key={`${fila.periodo}-${fila.sede}`} className="border-b">
                                                        <td className="p-3 font-semibold">{fila.periodo}</td>
                                                        <td className="p-3">{fila.sede}</td>
                                                        <td className="p-3">{fila.confirmados}</td>
                                                        <td className="p-3">{fila.certificados}</td>
                                                        <td className="p-3 font-semibold">
                                                            {formatearImporte(fila.facturacion)}
                                                        </td>
                                                        <td className="p-3">{fila.caidas}</td>
                                                        <td className="p-3">{fila.ausentes}</td>
                                                        <td className="p-3">{fila.ausentesReprogramadas}</td>
                                                        <td className="p-3">{fila.reprogramadasAusentes || 0}</td>

                                                        <td className="p-3">
                                                            {(
                                                                fila.certificados /
                                                                contarDiasHabilesDelMes(fila.anio, fila.mes)
                                                            ).toFixed(2)}
                                                        </td>

                                                        <td className="p-3">
                                                            {formatearPorcentaje(
                                                                porcentaje(
                                                                    fila.caidas,
                                                                    fila.confirmados +
                                                                    fila.certificados +
                                                                    fila.caidas +
                                                                    fila.ausentes
                                                                )
                                                            )}
                                                        </td>

                                                        <td className="p-3">
                                                            {formatearPorcentaje(
                                                                porcentaje(
                                                                    fila.ausentes,
                                                                    fila.confirmados + fila.certificados + fila.ausentes
                                                                )
                                                            )}
                                                        </td>

                                                        <td className="p-3">
                                                            {formatearPorcentaje(
                                                                porcentaje(
                                                                    fila.ausentesReprogramadas,
                                                                    fila.ausentes
                                                                )
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </main >
    );
}