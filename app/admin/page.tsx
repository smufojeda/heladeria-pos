"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  Package,
  Calendar,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Sparkles,
  Wallet,
  PlusCircle,
  X,
  BookOpenCheck,
  ShoppingCart,
  User,
  Eye,
  EyeOff,
  BarChart3,
  PieChart,
  AlertTriangle,
  Trash2,
  Edit3,
  Archive,
  History,
  FileText,
  Lock,
  Unlock,
  LayoutDashboard,
  UserCheck
} from "lucide-react";

interface PagoParcial {
  metodo: "efectivo" | "nequi" | "daviplata" | "tarjeta" | "fiado";
  monto: number;
  montoEntregadoEfectivo?: number;
  cambioEfectivo?: number;
  clienteFiado?: string;
}

interface Venta {
  id: number;
  created_at: string;
  cierre_diario_id?: number;
  mesa_id: number;
  numero_mesa: number;
  metodo_pago: string;
  desglose_pagos?: PagoParcial[];
  cliente_nombre?: string;
  subtotal: number;
  descuento: number;
  total: number;
  items_detalle: { nombre: string; cantidad: number; precio: number }[];
}

interface Gasto {
  id?: number;
  cierre_diario_id?: number;
  fecha: string;
  descripcion: string;
  monto: number;
  created_at?: string;
}

interface Producto {
  id: number;
  nombre: string;
  categoria: string;
  precio: number;
  stock: number;
  disponible: boolean;
}

interface CierreDiarioRecord {
  id: number;
  created_at: string;
  fecha: string;
  monto_inicial: number;
  monto_cierre_declarado?: number;
  monto_declarado?: number;
  monto_cierre_esperado?: number;
  monto_esperado?: number;
  diferencia: number;
  razon_diferencia: string;
  es_cuadrado: boolean;
  total_efectivo: number;
  total_nequi: number;
  total_daviplata: number;
  total_tarjeta: number;
  total_fiado: number;
  total_gastos: number;
  cobro_turno?: number;
  empleado_turno?: string;
  estado: string;
}

interface CierreSemanal {
  id: number;
  created_at: string;
  fecha_inicio: string;
  fecha_fin: string;
  total_ingresos: number;
  total_gastos: number;
  caja_neta: number;
  total_fiados_pendientes: number;
  ventas_resumen: Venta[];
  gastos_resumen: Gasto[];
}

interface EstadoCaja {
  id?: number;
  abierta: boolean;
  monto_inicial: number;
  fecha_apertura?: string;
}

export default function AdminDashboard() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cierresDiarios, setCierresDiarios] = useState<CierreDiarioRecord[]>([]);
  const [cierresSemanales, setCierresSemanales] = useState<CierreSemanal[]>([]);
  const [estadoCaja, setEstadoCaja] = useState<EstadoCaja>({ abierta: false, monto_inicial: 0 });
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<"resumen" | "historial" | "stock" | "cierres">("resumen");

  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [openItems, setOpenItems] = useState<Record<number, boolean>>({});

  const [selectedFiado, setSelectedFiado] = useState<Venta | null>(null);
  const [newPaymentMethod, setNewPaymentMethod] = useState<"efectivo" | "nequi" | "daviplata" | "tarjeta">("efectivo");
  const [showAllFiadosModal, setShowAllFiadosModal] = useState(false);
  const [showAllGastosModal, setShowAllGastosModal] = useState(false);
  const [showGastoModal, setShowGastoModal] = useState<string | null>(null);
  const [gastoText, setGastoText] = useState("");
  const [gastoMonto, setGastoMonto] = useState("");

  const [editingStockProduct, setEditingStockProduct] = useState<Producto | null>(null);
  const [newStockValue, setNewStockValue] = useState<string>("");
  const [showCerrarSemanaModal, setShowCerrarSemanaModal] = useState(false);
  const [showHistorialSemanalModal, setShowHistorialSemanalModal] = useState(false);

  const [confirmModalData, setConfirmModalData] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: async () => {},
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: vData } = await supabase.from("ventas").select("*").order("created_at", { ascending: false });
      const { data: pData } = await supabase.from("productos").select("*").order("stock", { ascending: true });
      const { data: gData } = await supabase.from("gastos").select("*").order("created_at", { ascending: false });
      const { data: cdData } = await supabase.from("cierres_diarios").select("*").order("created_at", { ascending: false });
      const { data: csData } = await supabase.from("cierres_semanales").select("*").order("created_at", { ascending: false });
      
      try {
        const { data: cjData } = await supabase.from("caja_estado").select("*").single();
        if (cjData) setEstadoCaja(cjData as EstadoCaja);
      } catch (_) {}

      if (vData) setVentas(vData as Venta[]);
      if (pData) setProductos(pData as Producto[]);
      if (gData) setGastos(gData as Gasto[]);
      if (cdData) setCierresDiarios(cdData as CierreDiarioRecord[]);
      if (csData) setCierresSemanales(csData as CierreSemanal[]);
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => {
    loadData();

    const channelCaja = supabase
      .channel("admin_realtime_sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "ventas" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "gastos" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "cierres_diarios" }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channelCaja);
    };
  }, []);

  const cierreAbiertoActual = useMemo(() => {
    return cierresDiarios.find((c) => c.estado === "abierto") || null;
  }, [cierresDiarios]);

  const ventasDiaActual = useMemo(() => {
    if (!cierreAbiertoActual) return [];
    return ventas.filter((v) => v.cierre_diario_id === cierreAbiertoActual.id);
  }, [ventas, cierreAbiertoActual]);

  const gastosDiaActual = useMemo(() => {
    if (!cierreAbiertoActual) return [];
    return gastos.filter((g) => g.cierre_diario_id === cierreAbiertoActual.id);
  }, [gastos, cierreAbiertoActual]);

  const totalIngresosHoy = useMemo(() => {
    return ventasDiaActual.reduce((acc, v) => {
      if (v.desglose_pagos && Array.isArray(v.desglose_pagos) && v.desglose_pagos.length > 0) {
        return acc + v.desglose_pagos.filter((p) => p.metodo !== "fiado").reduce((sum, p) => sum + p.monto, 0);
      }
      return acc + (!v.metodo_pago?.toLowerCase().includes("fiado") ? v.total || 0 : 0);
    }, 0);
  }, [ventasDiaActual]);

  const totalFiadosHoy = useMemo(() => {
    return ventasDiaActual.reduce((acc, v) => {
      if (v.desglose_pagos && Array.isArray(v.desglose_pagos) && v.desglose_pagos.length > 0) {
        const fiadoObj = v.desglose_pagos.find((p) => p.metodo === "fiado");
        return acc + (fiadoObj ? fiadoObj.monto : 0);
      }
      return acc + (v.metodo_pago?.toLowerCase().includes("fiado") ? v.total || 0 : 0);
    }, 0);
  }, [ventasDiaActual]);

  const totalGastosHoy = useMemo(() => {
    return gastosDiaActual.reduce((acc, g) => acc + (g.monto || 0), 0);
  }, [gastosDiaActual]);

  const ventasPorDia = useMemo(() => {
    const grupos: Record<string, Venta[]> = {};
    ventas.forEach((v) => {
      const fecha = new Date(v.created_at).toISOString().split("T")[0];
      if (!grupos[fecha]) grupos[fecha] = [];
      grupos[fecha].push(v);
    });
    return grupos;
  }, [ventas]);

  const gastosPorDia = useMemo(() => {
    const grupos: Record<string, Gasto[]> = {};
    gastos.forEach((g) => {
      if (!grupos[g.fecha]) grupos[g.fecha] = [];
      grupos[g.fecha].push(g);
    });
    return grupos;
  }, [gastos]);

  const listaFiadosActivos = useMemo(() => {
    return ventas.filter((v) => {
      if (v.desglose_pagos && Array.isArray(v.desglose_pagos) && v.desglose_pagos.length > 0) {
        return v.desglose_pagos.some((p) => p.metodo === "fiado");
      }
      return v.metodo_pago?.toLowerCase().includes("fiado");
    });
  }, [ventas]);

  const toggleFolder = (fecha: string) => setOpenFolders((prev) => ({ ...prev, [fecha]: !prev[fecha] }));
  const toggleItems = (ventaId: number) => setOpenItems((prev) => ({ ...prev, [ventaId]: !prev[ventaId] }));

  const requestConfirmation = (title: string, message: string, onConfirmAction: () => Promise<void>) => {
    setConfirmModalData({
      isOpen: true,
      title,
      message,
      onConfirm: async () => {
        await onConfirmAction();
        setConfirmModalData((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleDeleteCierreDiario = (id: number, fecha: string) => {
    requestConfirmation(
      "Eliminar Cierre Diario",
      `¿Estás seguro de eliminar el registro de Cierre Diario del día ${fecha}?`,
      async () => {
        const { error } = await supabase.from("cierres_diarios").delete().eq("id", id);
        if (!error) loadData();
      }
    );
  };

  const handleDeleteVenta = (id: number) => {
    requestConfirmation(
      "Eliminar Comanda/Venta",
      `¿Deseas eliminar permanentemente la comanda #${id}?`,
      async () => {
        await supabase.from("ventas").delete().eq("id", id);
        loadData();
      }
    );
  };

  const handleDeleteGasto = (id?: number) => {
    if (!id) return;
    requestConfirmation(
      "Eliminar Registro de Gasto",
      "¿Estás seguro de eliminar este gasto?",
      async () => {
        await supabase.from("gastos").delete().eq("id", id);
        loadData();
      }
    );
  };

  const handleDeleteDia = (fecha: string) => {
    requestConfirmation(
      "Eliminar Día Completo",
      `⚠️ ¿Estás seguro de eliminar TODOS los registros del día ${fecha}?`,
      async () => {
        const ventaIds = (ventasPorDia[fecha] || []).map((v) => v.id);
        const gastoIds = (gastosPorDia[fecha] || []).map((g) => g.id).filter(Boolean);

        if (ventaIds.length > 0) await supabase.from("ventas").delete().in("id", ventaIds);
        if (gastoIds.length > 0) await supabase.from("gastos").delete().in("id", gastoIds);

        loadData();
      }
    );
  };

  const handleDeleteSemanaArchivada = (id: number, fechaInicio: string, fechaFin: string) => {
    requestConfirmation(
      "Eliminar Semana Archivada",
      `¿Estás seguro de borrar el archivo semanal (${fechaInicio} a ${fechaFin})?`,
      async () => {
        await supabase.from("cierres_semanales").delete().eq("id", id);
        loadData();
      }
    );
  };

  const handleDeleteProducto = (id: number, nombre: string) => {
    requestConfirmation(
      "Eliminar Producto",
      `¿Deseas eliminar definitivamente "${nombre}"?`,
      async () => {
        await supabase.from("productos").delete().eq("id", id);
        loadData();
      }
    );
  };

  const handleSaveStock = async () => {
    if (!editingStockProduct) return;
    const stockVal = parseInt(newStockValue);
    if (isNaN(stockVal) || stockVal < 0) return alert("Ingresa una cantidad válida.");

    const { error } = await supabase
      .from("productos")
      .update({ stock: stockVal, disponible: stockVal > 0 })
      .eq("id", editingStockProduct.id);

    if (!error) {
      setEditingStockProduct(null);
      loadData();
    }
  };

  const handleConfirmCerrarSemana = async () => {
    if (ventas.length === 0 && gastos.length === 0) {
      alert("No hay registros activos para archivar.");
      setShowCerrarSemanaModal(false);
      return;
    }

    const fechasVentas = ventas.map((v) => new Date(v.created_at).toISOString().split("T")[0]);
    const fechasGastos = gastos.map((g) => g.fecha);
    const todasFechas = [...fechasVentas, ...fechasGastos].sort();

    const fechaInicio = todasFechas[0] || new Date().toISOString().split("T")[0];
    const fechaFin = todasFechas[todasFechas.length - 1] || new Date().toISOString().split("T")[0];

    const { error } = await supabase.from("cierres_semanales").insert({
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      total_ingresos: totalIngresos,
      total_gastos: totalGastosCompras,
      caja_neta: totalIngresos - totalGastosCompras,
      total_fiados_pendientes: totalFiadosPendientes,
      ventas_resumen: ventas,
      gastos_resumen: gastos,
    });

    if (!error) {
      const vIds = ventas.map((v) => v.id);
      const gIds = gastos.map((g) => g.id).filter(Boolean);

      if (vIds.length > 0) await supabase.from("ventas").delete().in("id", vIds);
      if (gIds.length > 0) await supabase.from("gastos").delete().in("id", gIds);

      setShowCerrarSemanaModal(false);
      loadData();
    }
  };

  const handleSaldarFiado = async () => {
    if (!selectedFiado) return;

    let updatedDesglose = selectedFiado.desglose_pagos;
    if (updatedDesglose && Array.isArray(updatedDesglose)) {
      updatedDesglose = updatedDesglose.map((p) =>
        p.metodo === "fiado" ? { ...p, metodo: newPaymentMethod } : p
      );
    }

    const nuevoMetodoTexto = updatedDesglose
      ? updatedDesglose.map((p) => p.metodo).join(", ")
      : newPaymentMethod;

    const { error } = await supabase
      .from("ventas")
      .update({
        metodo_pago: nuevoMetodoTexto,
        desglose_pagos: updatedDesglose,
      })
      .eq("id", selectedFiado.id);

    if (!error) {
      setSelectedFiado(null);
      loadData();
    }
  };

  const handleAddGasto = async () => {
    if (!showGastoModal || !gastoText.trim() || !gastoMonto) return;

    const montoVal = Number(gastoMonto) || 0;
    const nowIso = new Date().toISOString();

    const { error } = await supabase.from("gastos").insert({
      fecha: showGastoModal,
      descripcion: gastoText.trim(),
      monto: montoVal,
      created_at: nowIso,
    });

    if (!error) loadData();

    setGastoText("");
    setGastoMonto("");
    setShowGastoModal(null);
  };

  const totalIngresos = useMemo(() => {
    return ventas.reduce((acc, v) => {
      if (v.desglose_pagos && Array.isArray(v.desglose_pagos) && v.desglose_pagos.length > 0) {
        return acc + v.desglose_pagos.filter((p) => p.metodo !== "fiado").reduce((sum, p) => sum + p.monto, 0);
      }
      return acc + (!v.metodo_pago?.toLowerCase().includes("fiado") ? v.total || 0 : 0);
    }, 0);
  }, [ventas]);

  const totalFiadosPendientes = useMemo(() => {
    return ventas.reduce((acc, v) => {
      if (v.desglose_pagos && Array.isArray(v.desglose_pagos) && v.desglose_pagos.length > 0) {
        const fiadoObj = v.desglose_pagos.find((p) => p.metodo === "fiado");
        return acc + (fiadoObj ? fiadoObj.monto : 0);
      }
      return acc + (v.metodo_pago?.toLowerCase().includes("fiado") ? v.total || 0 : 0);
    }, 0);
  }, [ventas]);

  const totalGastosCompras = useMemo(() => gastos.reduce((acc, g) => acc + (g.monto || 0), 0), [gastos]);

  const distribucionMetodos = useMemo(() => {
    const map: Record<string, number> = {};
    ventas.forEach((v) => {
      if (v.desglose_pagos && Array.isArray(v.desglose_pagos) && v.desglose_pagos.length > 0) {
        v.desglose_pagos.forEach((p) => {
          const m = p.metodo.toLowerCase();
          map[m] = (map[m] || 0) + (p.monto || 0);
        });
      } else {
        const m = (v.metodo_pago || "efectivo").toLowerCase();
        map[m] = (map[m] || 0) + (v.total || 0);
      }
    });
    return Object.entries(map).map(([metodo, total]) => ({ metodo, total }));
  }, [ventas]);

  const topProductos = useMemo(() => {
    const map: Record<string, number> = {};
    ventas.forEach((v) => {
      if (v.items_detalle && Array.isArray(v.items_detalle)) {
        v.items_detalle.forEach((it) => {
          map[it.nombre] = (map[it.nombre] || 0) + it.cantidad;
        });
      }
    });
    return Object.entries(map)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);
  }, [ventas]);

  const maxVentaMetodo = useMemo(() => Math.max(...distribucionMetodos.map((d) => d.total), 1), [distribucionMetodos]);
  const maxCantProd = useMemo(() => Math.max(...topProductos.map((p) => p.cantidad), 1), [topProductos]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased p-3 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 sm:p-5 rounded-3xl shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2.5 bg-slate-950 border border-slate-800 rounded-2xl hover:bg-slate-800 text-pink-400 transition-all cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-amber-300 uppercase">
                  Anti Café Admin
                </h1>
                
                <div className={`px-2.5 py-1 rounded-full border text-[10px] font-black uppercase flex items-center gap-1.5 ${
                  cierreAbiertoActual 
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                    : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                }`}>
                  {cierreAbiertoActual ? (
                    <>
                      <Unlock className="w-3 h-3 text-emerald-400 animate-pulse" /> 
                      Día Abierto ( Base: ${cierreAbiertoActual.monto_inicial?.toLocaleString()} )
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3 text-rose-400" /> Día Cerrado
                    </>
                  )}
                </div>
              </div>
              <p className="text-[10px] sm:text-xs font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                <Sparkles className="w-3 h-3 text-pink-400" /> Control operativo y métricas integradas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap">
            <button
              onClick={() => setShowHistorialSemanalModal(true)}
              className="flex-1 lg:flex-none px-3 py-2 bg-slate-950 border border-purple-500/40 text-purple-300 hover:bg-purple-950/40 font-black rounded-xl text-xs uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-purple-400" /> Semanas ({cierresSemanales.length})
            </button>

            <button
              onClick={() => setShowCerrarSemanaModal(true)}
              className="flex-1 lg:flex-none px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black rounded-xl text-xs uppercase flex items-center justify-center gap-1.5 shadow-md hover:brightness-110 cursor-pointer transition-all"
            >
              <Archive className="w-3.5 h-3.5" /> Archivar Semana
            </button>

            <button
              onClick={() => setShowAllGastosModal(true)}
              className="flex-1 lg:flex-none px-3.5 py-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white font-black rounded-xl text-xs uppercase flex items-center justify-center gap-1.5 shadow-md hover:brightness-110 cursor-pointer transition-all"
            >
              <ShoppingCart className="w-3.5 h-3.5" /> Gastos (${totalGastosCompras.toLocaleString()})
            </button>

            <button
              onClick={() => setShowAllFiadosModal(true)}
              className="flex-1 lg:flex-none px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black rounded-xl text-xs uppercase flex items-center justify-center gap-1.5 shadow-md hover:brightness-110 cursor-pointer transition-all"
            >
              <BookOpenCheck className="w-3.5 h-3.5" /> Fiados ({listaFiadosActivos.length})
            </button>

            <button onClick={loadData} className="p-2 bg-slate-800 border border-slate-700 rounded-xl text-cyan-300 transition-all cursor-pointer hover:bg-slate-700">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* NAVEGACIÓN POR PESTAÑAS */}
        <div className="flex border-b border-slate-800 overflow-x-auto gap-2 scrollbar-none">
          <button
            onClick={() => setActiveTab("resumen")}
            className={`px-4 py-2.5 rounded-t-2xl font-black text-xs uppercase flex items-center gap-2 border-t border-x transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "resumen"
                ? "bg-slate-900 border-slate-700 text-pink-400"
                : "bg-slate-950/50 border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" /> Resumen y Métricas
          </button>

          <button
            onClick={() => setActiveTab("historial")}
            className={`px-4 py-2.5 rounded-t-2xl font-black text-xs uppercase flex items-center gap-2 border-t border-x transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "historial"
                ? "bg-slate-900 border-slate-700 text-pink-400"
                : "bg-slate-950/50 border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Calendar className="w-4 h-4" /> Historial Diario ({Object.keys(ventasPorDia).length})
          </button>

          <button
            onClick={() => setActiveTab("cierres")}
            className={`px-4 py-2.5 rounded-t-2xl font-black text-xs uppercase flex items-center gap-2 border-t border-x transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "cierres"
                ? "bg-slate-900 border-slate-700 text-amber-400"
                : "bg-slate-950/50 border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileText className="w-4 h-4" /> Auditoría Cierres ({cierresDiarios.length})
          </button>

          <button
            onClick={() => setActiveTab("stock")}
            className={`px-4 py-2.5 rounded-t-2xl font-black text-xs uppercase flex items-center gap-2 border-t border-x transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "stock"
                ? "bg-slate-900 border-slate-700 text-cyan-400"
                : "bg-slate-950/50 border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Package className="w-4 h-4" /> Stock ({productos.length})
          </button>
        </div>

        {/* PESTAÑA 1: RESUMEN Y MÉTRICAS */}
        {activeTab === "resumen" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase text-pink-400 tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Métricas del Día Actual (Jornada Activa)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-slate-900/80 border border-emerald-500/40 p-4 rounded-2xl flex items-center justify-between shadow-lg">
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-400 block">Recaudado Hoy</span>
                    <span className="text-xl font-black text-emerald-400 font-mono">${totalIngresosHoy.toLocaleString()}</span>
                  </div>
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-2xl border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-amber-500/40 p-4 rounded-2xl flex items-center justify-between shadow-lg">
                  <div>
                    <span className="text-[10px] font-black uppercase text-amber-400 block">Fiados Hoy</span>
                    <span className="text-xl font-black text-amber-400 font-mono">${totalFiadosHoy.toLocaleString()}</span>
                  </div>
                  <div className="w-10 h-10 bg-amber-500/10 rounded-2xl border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <BookOpenCheck className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-rose-500/40 p-4 rounded-2xl flex items-center justify-between shadow-lg">
                  <div>
                    <span className="text-[10px] font-black uppercase text-rose-400 block">Gastos Insumos Hoy</span>
                    <span className="text-xl font-black text-rose-400 font-mono">${totalGastosHoy.toLocaleString()}</span>
                  </div>
                  <div className="w-10 h-10 bg-rose-500/10 rounded-2xl border border-rose-500/30 flex items-center justify-center text-rose-400">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-cyan-500/40 p-4 rounded-2xl flex items-center justify-between shadow-lg">
                  <div>
                    <span className="text-[10px] font-black uppercase text-cyan-400 block">Caja Neta Hoy</span>
                    <span className="text-xl font-black text-cyan-400 font-mono">${(totalIngresosHoy - totalGastosHoy).toLocaleString()}</span>
                  </div>
                  <div className="w-10 h-10 bg-cyan-500/10 rounded-2xl border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-slate-400" /> Acumulado Histórico Global
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-lg">
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 block">Total Recaudado Global</span>
                    <span className="text-xl font-black text-emerald-400 font-mono">${totalIngresos.toLocaleString()}</span>
                  </div>
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-2xl border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-lg">
                  <div>
                    <span className="text-[10px] font-black uppercase text-amber-400 block">Fiados por Cobrar Global</span>
                    <span className="text-xl font-black text-amber-400 font-mono">${totalFiadosPendientes.toLocaleString()}</span>
                  </div>
                  <div className="w-10 h-10 bg-amber-500/10 rounded-2xl border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <BookOpenCheck className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-lg">
                  <div>
                    <span className="text-[10px] font-black uppercase text-rose-400 block">Total Gastos Global</span>
                    <span className="text-xl font-black text-rose-400 font-mono">${totalGastosCompras.toLocaleString()}</span>
                  </div>
                  <div className="w-10 h-10 bg-rose-500/10 rounded-2xl border border-rose-500/30 flex items-center justify-center text-rose-400">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-lg">
                  <div>
                    <span className="text-[10px] font-black uppercase text-cyan-400 block">Caja Neta Global</span>
                    <span className="text-xl font-black text-cyan-400 font-mono">${(totalIngresos - totalGastosCompras).toLocaleString()}</span>
                  </div>
                  <div className="w-10 h-10 bg-cyan-500/10 rounded-2xl border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl space-y-4">
                <h3 className="text-sm font-black uppercase text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                  <BarChart3 className="w-4 h-4 text-pink-400" /> Distribución por Métodos de Pago
                </h3>
                <div className="space-y-3">
                  {distribucionMetodos.length === 0 ? (
                    <p className="text-xs text-slate-500 font-bold py-2 text-center">Sin transacciones registradas</p>
                  ) : (
                    distribucionMetodos.map((item) => {
                      const porcentaje = Math.round((item.total / maxVentaMetodo) * 100);
                      return (
                        <div key={item.metodo} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="uppercase text-slate-300">{item.metodo}</span>
                            <span className="font-mono text-emerald-400">${item.total.toLocaleString()}</span>
                          </div>
                          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                            <div className="bg-gradient-to-r from-pink-500 to-purple-500 h-full rounded-full" style={{ width: `${porcentaje}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl space-y-4">
                <h3 className="text-sm font-black uppercase text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                  <PieChart className="w-4 h-4 text-amber-400" /> Top 5 Productos Vendidos
                </h3>
                <div className="space-y-3">
                  {topProductos.length === 0 ? (
                    <p className="text-xs text-slate-500 font-bold py-2 text-center">Sin productos vendidos aún</p>
                  ) : (
                    topProductos.map((prod) => {
                      const porcentaje = Math.round((prod.cantidad / maxCantProd) * 100);
                      return (
                        <div key={prod.nombre} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-300 truncate max-w-[180px]">{prod.nombre}</span>
                            <span className="font-mono text-amber-400">{prod.cantidad} unds</span>
                          </div>
                          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                            <div className="bg-gradient-to-r from-amber-400 to-orange-500 h-full rounded-full" style={{ width: `${porcentaje}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 2: HISTORIAL DE DÍAS */}
        {activeTab === "historial" && (
          <div className="space-y-4 animate-fadeIn">
            {loading ? (
              <div className="text-center py-12 text-slate-500 font-bold text-xs">Cargando reporte...</div>
            ) : Object.keys(ventasPorDia).length === 0 ? (
              <div className="text-center py-12 text-slate-500 font-bold text-xs bg-slate-900 rounded-3xl border border-slate-800">
                ☕ No hay ventas registradas todavía.
              </div>
            ) : (
              Object.entries(ventasPorDia).map(([fecha, ventasDia]) => {
                const isOpen = !!openFolders[fecha];
                const gastosDia = gastosPorDia[fecha] || [];

                const totalBrutoDia = ventasDia.reduce((acc, v) => {
                  if (v.desglose_pagos && Array.isArray(v.desglose_pagos) && v.desglose_pagos.length > 0) {
                    return acc + v.desglose_pagos.filter((p) => p.metodo !== "fiado").reduce((s, p) => s + p.monto, 0);
                  }
                  return acc + (!v.metodo_pago?.toLowerCase().includes("fiado") ? v.total || 0 : 0);
                }, 0);

                const totalGastosDia = gastosDia.reduce((a, b) => a + (b.monto || 0), 0);
                const totalNetoDia = totalBrutoDia - totalGastosDia;

                const porMetodo = ventasDia.reduce((acc, v) => {
                  if (v.desglose_pagos && Array.isArray(v.desglose_pagos) && v.desglose_pagos.length > 0) {
                    v.desglose_pagos.forEach((p) => {
                      const m = p.metodo.toLowerCase();
                      acc[m] = (acc[m] || 0) + p.monto;
                    });
                  } else {
                    const m = (v.metodo_pago || "efectivo").toLowerCase();
                    acc[m] = (acc[m] || 0) + (v.total || 0);
                  }
                  return acc;
                }, {} as Record<string, number>);

                return (
                  <div key={fecha} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                    <div className="p-3.5 bg-slate-900/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800">
                      <button onClick={() => toggleFolder(fecha)} className="flex items-center gap-3 cursor-pointer text-left">
                        {isOpen ? <FolderOpen className="w-5 h-5 text-pink-400" /> : <Folder className="w-5 h-5 text-pink-500" />}
                        <div>
                          <span className="font-black text-xs sm:text-sm text-white block">{fecha}</span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {ventasDia.length} Transacciones | {gastosDia.length} Gastos
                          </span>
                        </div>
                      </button>

                      <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
                        <div className="text-right mr-2">
                          <span className="text-[8px] font-black uppercase text-slate-400 block">Total Neto Día</span>
                          <span className="font-mono text-emerald-400 font-black text-xs sm:text-sm">${totalNetoDia.toLocaleString()}</span>
                        </div>

                        <button
                          onClick={() => setShowGastoModal(fecha)}
                          className="px-2 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-lg text-[10px] font-black hover:bg-rose-500 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <PlusCircle className="w-3 h-3" /> Gasto
                        </button>

                        <button
                          onClick={() => handleDeleteDia(fecha)}
                          className="p-1 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/30 text-rose-400 hover:text-white rounded-lg transition-all cursor-pointer"
                          title="Eliminar este día"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <button onClick={() => toggleFolder(fecha)} className="p-1 cursor-pointer">
                          {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="p-3 space-y-3 bg-slate-950/50">
                        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                          <h4 className="text-[9px] font-black uppercase text-pink-400 mb-1.5 flex items-center gap-1">
                            <Wallet className="w-3 h-3" /> Desglose por Método:
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[11px] font-bold">
                            <div className="p-1.5 bg-slate-900 rounded-lg border border-slate-800 text-slate-300">
                              💵 Efectivo: <span className="font-mono text-emerald-400 block text-[10px]">${(porMetodo["efectivo"] || 0).toLocaleString()}</span>
                            </div>
                            <div className="p-1.5 bg-slate-900 rounded-lg border border-slate-800 text-slate-300">
                              📱 Nequi: <span className="font-mono text-purple-400 block text-[10px]">${(porMetodo["nequi"] || 0).toLocaleString()}</span>
                            </div>
                            <div className="p-1.5 bg-slate-900 rounded-lg border border-slate-800 text-slate-300">
                              🔴 Daviplata: <span className="font-mono text-rose-400 block text-[10px]">${(porMetodo["daviplata"] || 0).toLocaleString()}</span>
                            </div>
                            <div className="p-1.5 bg-slate-900 rounded-lg border border-slate-800 text-slate-300">
                              💳 Tarjeta: <span className="font-mono text-cyan-400 block text-[10px]">${(porMetodo["tarjeta"] || 0).toLocaleString()}</span>
                            </div>
                            <div className="p-1.5 bg-amber-950/40 rounded-lg border border-amber-500/40 text-amber-300">
                              📌 Fiado: <span className="font-mono text-amber-400 block text-[10px]">${(porMetodo["fiado"] || 0).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-[9px] font-black uppercase text-slate-400">Comandas y Transacciones:</h4>
                          {ventasDia.map((v) => {
                            const tieneFiado = v.desglose_pagos
                              ? v.desglose_pagos.some((p) => p.metodo === "fiado")
                              : v.metodo_pago?.toLowerCase().includes("fiado");

                            const itemsVisibles = !!openItems[v.id];

                            return (
                              <div key={v.id} className={`p-3 rounded-xl border space-y-1.5 transition-all ${tieneFiado ? "bg-amber-950/20 border-amber-500/60" : "bg-slate-950 border-slate-800"}`}>
                                <div className="flex justify-between items-center pb-1 border-b border-slate-900">
                                  <div>
                                    <span className="font-black text-xs text-white block">Espacio #{v.numero_mesa || v.mesa_id}</span>
                                    {tieneFiado && v.cliente_nombre && (
                                      <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                                        <User className="w-3 h-3" /> Cliente: {v.cliente_nombre}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-mono text-slate-400">
                                      {new Date(v.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>

                                    <button
                                      onClick={() => toggleItems(v.id)}
                                      className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-pink-400 transition-all cursor-pointer flex items-center gap-1 border border-slate-800 text-[9px] font-bold"
                                    >
                                      {itemsVisibles ? <EyeOff className="w-3 h-3 text-pink-400" /> : <Eye className="w-3 h-3 text-slate-400" />}
                                      <span className="hidden sm:inline">{itemsVisibles ? "Ocultar" : "Items"}</span>
                                    </button>

                                    <button onClick={() => handleDeleteVenta(v.id)} className="p-1 text-slate-500 hover:text-rose-400 transition-all cursor-pointer">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {itemsVisibles && (
                                  <div className="space-y-1 my-1.5 bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                                    {v.items_detalle?.map((item, idx) => (
                                      <div key={idx} className="flex justify-between text-[10px] font-bold text-slate-300">
                                        <span>{item.cantidad}x {item.nombre}</span>
                                        <span className="font-mono text-slate-400">${(item.precio * item.cantidad).toLocaleString()}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <div className="pt-1 border-t border-slate-900 flex justify-between items-center text-xs font-black">
                                  <span className={`uppercase text-[8px] px-2 py-0.5 rounded-full border ${tieneFiado ? "bg-amber-500/20 text-amber-300 border-amber-500/50" : "bg-slate-900 text-pink-400 border-slate-800"}`}>
                                    Pago: {v.metodo_pago}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-emerald-400 text-xs sm:text-sm">${v.total?.toLocaleString()}</span>
                                    {tieneFiado && (
                                      <button
                                        onClick={() => setSelectedFiado(v)}
                                        className="px-2.5 py-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-[9px] uppercase rounded-lg cursor-pointer"
                                      >
                                        Saldar
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* PESTAÑA 3: AUDITORÍA DE CIERRES DIARIOS (DETALLADA) */}
        {activeTab === "cierres" && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
              <h3 className="text-sm font-black uppercase text-amber-400 flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-amber-400" /> Registros Completos de Auditoría de Cierre
              </h3>

              {cierresDiarios.length === 0 ? (
                <p className="text-xs text-slate-500 font-bold text-center py-6">No hay cierres diarios guardados todavía.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cierresDiarios.map((cd) => {
                    const declarado = cd.monto_cierre_declarado ?? cd.monto_declarado ?? 0;
                    const esperado = cd.monto_cierre_esperado ?? cd.monto_esperado ?? 0;

                    return (
                      <div key={cd.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5 relative shadow-lg">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-800 pr-7">
                          <div>
                            <span className="font-black text-xs text-amber-300 block">{cd.fecha}</span>
                            <span className="text-[9px] text-slate-500 font-mono">
                              {new Date(cd.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${cd.es_cuadrado ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
                            {cd.es_cuadrado ? "Cuadrado" : "Con Diferencia"}
                          </span>
                        </div>

                        <button
                          onClick={() => handleDeleteCierreDiario(cd.id, cd.fecha)}
                          className="absolute top-3.5 right-3 p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white transition-all cursor-pointer"
                          title="Eliminar este cierre"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <div className="space-y-1.5 text-xs">
                          {cd.empleado_turno && (
                            <div className="flex justify-between items-center p-1.5 bg-slate-900/80 rounded-lg text-slate-300 font-bold">
                              <span className="flex items-center gap-1 text-[11px] text-cyan-400"><UserCheck className="w-3.5 h-3.5" /> Cobró Turno:</span>
                              <span className="text-white">{cd.empleado_turno}</span>
                            </div>
                          )}

                          {cd.cobro_turno !== undefined && cd.cobro_turno > 0 && (
                            <div className="flex justify-between text-cyan-300 font-mono font-bold">
                              <span>Cobro de Turno:</span>
                              <span>-${(cd.cobro_turno || 0).toLocaleString()}</span>
                            </div>
                          )}

                          <div className="pt-1 border-t border-slate-900 space-y-1 font-mono">
                            <div className="flex justify-between text-slate-400"><span>Monto Inicial (Base):</span><span>${(cd.monto_inicial ?? 0).toLocaleString()}</span></div>
                            <div className="flex justify-between text-emerald-400"><span>Ventas Efectivo:</span><span>${(cd.total_efectivo ?? 0).toLocaleString()}</span></div>
                            <div className="flex justify-between text-purple-400"><span>Ventas Nequi:</span><span>${(cd.total_nequi ?? 0).toLocaleString()}</span></div>
                            <div className="flex justify-between text-rose-400"><span>Ventas Daviplata:</span><span>${(cd.total_daviplata ?? 0).toLocaleString()}</span></div>
                            <div className="flex justify-between text-cyan-400"><span>Ventas Tarjeta:</span><span>${(cd.total_tarjeta ?? 0).toLocaleString()}</span></div>
                            <div className="flex justify-between text-amber-400"><span>Ventas Fiado:</span><span>${(cd.total_fiado ?? 0).toLocaleString()}</span></div>
                            <div className="flex justify-between text-rose-400 font-bold"><span>Compra Insumos/Gastos:</span><span>-${(cd.total_gastos ?? 0).toLocaleString()}</span></div>
                          </div>

                          <div className="pt-2 border-t border-slate-800 font-mono space-y-1 font-black">
                            <div className="flex justify-between text-cyan-300"><span>Caja Esperada:</span><span>${esperado.toLocaleString()}</span></div>
                            <div className="flex justify-between text-emerald-300"><span>Caja Declarada:</span><span>${declarado.toLocaleString()}</span></div>
                            {(cd.diferencia ?? 0) !== 0 && (
                              <div className="flex justify-between text-rose-400"><span>Diferencia Descuadre:</span><span>${cd.diferencia.toLocaleString()}</span></div>
                            )}
                          </div>
                        </div>

                        {cd.razon_diferencia && (
                          <div className="p-2 bg-rose-950/20 border border-rose-500/30 rounded-xl space-y-0.5 mt-2">
                            <span className="text-[9px] font-black text-rose-400 uppercase block flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Razón del descuadre:
                            </span>
                            <p className="text-[10px] text-slate-300 italic">
                              "{cd.razon_diferencia}"
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PESTAÑA 4: CONTROL DE STOCK */}
        {activeTab === "stock" && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
              <h3 className="text-sm font-black text-white flex items-center gap-2 mb-4">
                <Package className="w-5 h-5 text-cyan-400" /> Inventario de Productos
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {productos.map((p) => {
                  const stockVal = p.stock ?? 0;
                  const isLow = stockVal < 15;

                  return (
                    <div key={p.id} className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex justify-between items-center">
                      <div>
                        <h5 className="font-black text-xs text-slate-100">{p.nombre}</h5>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">{p.categoria}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <span className={`text-xs font-black font-mono block ${isLow ? "text-rose-400" : "text-emerald-400"}`}>
                            {stockVal} Unds
                          </span>
                          {isLow && <span className="text-[8px] font-black text-rose-500 uppercase flex items-center justify-end gap-0.5"><AlertTriangle className="w-2.5 h-2.5" /> Bajo</span>}
                        </div>

                        <button
                          onClick={() => {
                            setEditingStockProduct(p);
                            setNewStockValue(stockVal.toString());
                          }}
                          className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 rounded-lg cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteProducto(p.id, p.nombre)}
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/30 text-rose-400 hover:text-white rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* MODAL MOSTRAR TODOS LOS GASTOS */}
      {showAllGastosModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-black text-base text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-rose-400" /> Resumen General de Gastos e Insumos
              </h3>
              <button onClick={() => setShowAllGastosModal(false)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {gastos.length === 0 ? (
                <p className="text-xs text-slate-500 font-bold text-center py-6">No hay gastos registrados.</p>
              ) : (
                gastos.map((g, idx) => (
                  <div key={g.id || idx} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-black text-xs text-slate-200 block">{g.descripcion}</span>
                      <span className="text-[10px] font-bold text-slate-500">{g.fecha}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-black text-rose-400">-${g.monto?.toLocaleString()}</span>
                      <button onClick={() => handleDeleteGasto(g.id)} className="text-slate-600 hover:text-rose-400 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL MOSTRAR TODOS LOS FIADOS */}
      {showAllFiadosModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-black text-base text-white flex items-center gap-2">
                <BookOpenCheck className="w-5 h-5 text-amber-400" /> Lista de Cuentas Fiadas
              </h3>
              <button onClick={() => setShowAllFiadosModal(false)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {listaFiadosActivos.length === 0 ? (
                <p className="text-xs text-slate-500 font-bold text-center py-6">No hay cuentas pendientes por cobrar.</p>
              ) : (
                listaFiadosActivos.map((v) => (
                  <div key={v.id} className="bg-slate-950 p-3 rounded-2xl border border-amber-500/40 flex items-center justify-between">
                    <div>
                      <span className="font-black text-xs text-amber-300 block uppercase">
                        {v.cliente_nombre ? `Cliente: ${v.cliente_nombre}` : `Mesa #${v.numero_mesa || v.mesa_id}`}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">{new Date(v.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-black text-emerald-400">${v.total?.toLocaleString()}</span>
                      <button
                        onClick={() => {
                          setSelectedFiado(v);
                          setShowAllFiadosModal(false);
                        }}
                        className="px-2.5 py-1 bg-emerald-500 text-slate-950 font-black text-[10px] uppercase rounded-lg cursor-pointer"
                      >
                        Saldar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR STOCK */}
      {editingStockProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-cyan-400" /> Modificar Stock
              </h3>
              <button onClick={() => setEditingStockProduct(null)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <span className="text-xs font-black text-slate-200 block">{editingStockProduct.nombre}</span>
              <span className="text-[10px] text-slate-400 uppercase font-bold">{editingStockProduct.categoria}</span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Nueva Cantidad Disponible:</label>
              <input
                type="number"
                value={newStockValue}
                onChange={(e) => setNewStockValue(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-black text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <button
              onClick={handleSaveStock}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black text-xs uppercase rounded-2xl shadow-lg cursor-pointer"
            >
              Guardar Nuevo Stock
            </button>
          </div>
        </div>
      )}

      {/* MODAL CERRAR SEMANA */}
      {showCerrarSemanaModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-black text-base text-white flex items-center gap-2">
                <Archive className="w-5 h-5 text-cyan-400" /> Cierre de Semana
              </h3>
              <button onClick={() => setShowCerrarSemanaModal(false)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs font-bold text-amber-300 leading-relaxed bg-amber-500/10 p-3 rounded-2xl border border-amber-500/30">
              ¿Estás seguro de que quieres archivar la semana? Los datos actuales de ventas y gastos pasarán al historial semanal y la pantalla inicial se limpiará.
            </p>

            <button
              onClick={handleConfirmCerrarSemana}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black text-xs uppercase rounded-2xl shadow-lg cursor-pointer"
            >
              Aceptar y Cerrar Semana
            </button>
          </div>
        </div>
      )}

      {/* MODAL HISTORIAL SEMANAL */}
      {showHistorialSemanalModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl relative space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-black text-base text-white flex items-center gap-2">
                <History className="w-5 h-5 text-purple-400" /> Historial Semanal
              </h3>
              <button onClick={() => setShowHistorialSemanalModal(false)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {cierresSemanales.map((semana) => (
                <div key={semana.id} className="bg-slate-950 p-4 rounded-2xl border border-purple-500/30 space-y-2 relative">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-900 pr-8">
                    <span className="font-black text-xs text-purple-300 uppercase">
                      Semana: {semana.fecha_inicio} al {semana.fecha_fin}
                    </span>
                    <span className="font-mono text-cyan-400 font-black text-sm">
                      Caja Neta: ${semana.caja_neta.toLocaleString()}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDeleteSemanaArchivada(semana.id, semana.fecha_inicio, semana.fecha_fin)}
                    className="absolute top-3.5 right-3 p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL SALDAR FIADO */}
      {selectedFiado && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-black text-base text-white flex items-center gap-2">
                <BookOpenCheck className="w-5 h-5 text-amber-400" /> Saldar Cuenta Fiada
              </h3>
              <button onClick={() => setSelectedFiado(null)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs space-y-1">
              {selectedFiado.cliente_nombre && (
                <p className="text-amber-400 font-black uppercase text-sm flex items-center gap-1.5">
                  <User className="w-4 h-4" /> Cliente: {selectedFiado.cliente_nombre}
                </p>
              )}
              <p className="text-slate-400 font-bold">Monto a cancelar:</p>
              <p className="text-xl font-black font-mono text-emerald-400">
                ${selectedFiado.total?.toLocaleString()}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-300 block">¿Con qué método pagó el cliente?</label>
              <div className="grid grid-cols-2 gap-2">
                {(["efectivo", "nequi", "daviplata", "tarjeta"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setNewPaymentMethod(m)}
                    className={`py-2 rounded-xl text-xs font-black uppercase transition-all border cursor-pointer ${
                      newPaymentMethod === m ? "bg-pink-500 text-white border-pink-400 shadow-md" : "bg-slate-950 text-slate-400 border-slate-800"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSaldarFiado}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs uppercase rounded-2xl shadow-lg cursor-pointer"
            >
              ✅ Marcar como Pagado
            </button>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR GASTO */}
      {showGastoModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-black text-base text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-rose-400" /> Agregar Gasto / Compra
              </h3>
              <button onClick={() => setShowGastoModal(null)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Descripción:</label>
                <input
                  type="text"
                  placeholder="Ej: Leche, Vasos..."
                  value={gastoText}
                  onChange={(e) => setGastoText(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Monto ($):</label>
                <input
                  type="number"
                  placeholder="Ej: 25000"
                  value={gastoMonto}
                  onChange={(e) => setGastoMonto(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-pink-500 font-mono"
                />
              </div>
            </div>

            <button
              onClick={handleAddGasto}
              className="w-full py-3 bg-gradient-to-r from-rose-500 to-pink-500 text-white font-black text-xs uppercase rounded-2xl shadow-lg cursor-pointer"
            >
              ➕ Registrar Gasto
            </button>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN ELIMINAR */}
      {confirmModalData.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/50 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-black text-base text-white uppercase">{confirmModalData.title}</h3>
              <p className="text-xs text-slate-300 font-bold mt-2 leading-relaxed">{confirmModalData.message}</p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setConfirmModalData((prev) => ({ ...prev, isOpen: false }))}
                className="flex-1 py-2.5 bg-slate-950 text-slate-300 font-black text-xs uppercase rounded-xl border border-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmModalData.onConfirm}
                className="flex-1 py-2.5 bg-rose-600 text-white font-black text-xs uppercase rounded-xl shadow-lg cursor-pointer flex items-center justify-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}