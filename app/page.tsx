"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  CreditCard,
  Receipt,
  Search,
  Sparkles,
  ArrowLeft,
  X,
  Plus,
  Minus,
  ChefHat,
  LayoutGrid,
  Check,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Send,
  Trash2,
  DollarSign,
  Calculator,
  Wallet,
  Lock,
  ChevronUp,
  ChevronDown,
  Sparkle,
  Zap,
  MoreVertical,
  Calendar,
  Edit2,
  PlusCircle,
  AlertTriangle,
  Pencil,
  RotateCcw,
  UserCheck
} from "lucide-react";

type EstadoMesa = "libre" | "pendiente_servir" | "preparado" | "servido" | "pendiente_pago";
type ModoVista = "caja" | "mesero" | "cocina";
type MetodoPago = "efectivo" | "nequi" | "daviplata" | "tarjeta" | "fiado";

interface Mesa {
  id: number;
  numero: number;
  nombre: string;
  estado: EstadoMesa;
  capacidad: number;
}

interface Producto {
  id: number;
  nombre: string;
  categoria: string;
  precio: number;
  descripcion: string;
  disponible: boolean;
  stock?: number;
}

interface CartItem {
  producto: Producto;
  cantidad: number;
  notas?: string;
  es_adicion?: boolean;
}

interface PagoParcial {
  metodo: MetodoPago;
  monto: number;
  montoEntregadoEfectivo?: number;
  cambioEfectivo?: number;
  clienteFiado?: string;
}

interface PedidoCocina {
  id: number;
  mesa_id: number;
  created_at: string;
  estado_pedido: string;
  total: number;
  mesas: { nombre: string; numero: number };
  pedido_items: {
    id: number;
    cantidad: number;
    notas: string;
    es_adicion: boolean;
    precio_unitario: number;
    productos: { nombre: string };
  }[];
}

interface CierreDiario {
  id: number;
  fecha: string;
  monto_inicial: number;
  estado: "abierto" | "cerrado";
}

const formatCurrency = (amount: number | string | undefined | null) => {
  if (amount === undefined || amount === null || amount === "") return "0";
  const numericValue = typeof amount === "string" ? Number(amount.replace(/\D/g, "")) : amount;
  if (isNaN(numericValue)) return "0";
  return numericValue.toLocaleString("es-CO");
};

const parseCurrencyToNumber = (formattedStr: string): number => {
  if (!formattedStr) return 0;
  const cleanStr = formattedStr.replace(/\D/g, "");
  return Number(cleanStr) || 0;
};

const getNombreOriginal = (numero: number, idx: number) => {
  if (idx < 5) return `Mesa ${idx + 1}`;
  if (idx === 5) return "Barra 1";
  if (idx === 6) return "Barra 2";
  return `Espacio ${numero}`;
};

export default function HomePOS() {
  const router = useRouter();
  const [vista, setVista] = useState<ModoVista>("mesero");
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [pedidosCocina, setPedidosCocina] = useState<PedidoCocina[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [searchQuery, setSearchQuery] = useState("");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [initialItemsCount, setInitialItemsCount] = useState<number>(0);
  const [showMobileCart, setShowMobileCart] = useState(false);

  const [showCheckout, setShowCheckout] = useState(false);
  const [discountInput, setDiscountInput] = useState<string>("0");
  const [discountType, setDiscountType] = useState<"monto" | "porcentaje">("monto");
  
  const [pagos, setPagos] = useState<PagoParcial[]>([]);
  const [currentMetodo, setCurrentMetodo] = useState<MetodoPago>("efectivo");
  const [montoIngresado, setMontoIngresado] = useState<string>("");
  const [efectivoRecibido, setEfectivoRecibido] = useState<string>("");
  const [clienteFiado, setClienteFiado] = useState<string>("");
  const [saleCompleted, setSaleCompleted] = useState<boolean>(false);

  const [showAdminPinModal, setShowAdminPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

  const [cierreActivo, setCierreActivo] = useState<CierreDiario | null>(null);
  const [showAperturaModal, setShowAperturaModal] = useState(false);
  const [showAperturaRequeridaModal, setShowAperturaRequeridaModal] = useState(false);
  const [fechaApertura, setFechaApertura] = useState(new Date().toISOString().split("T")[0]);
  const [editFecha, setEditFecha] = useState(false);
  const [montoInicialFormatted, setMontoInicialFormatted] = useState("");

  const [showGastoModal, setShowGastoModal] = useState(false);
  const [gastoDesc, setGastoDesc] = useState("");
  const [gastoMonto, setGastoMonto] = useState("");

  const [showCobroTurnoModal, setShowCobroTurnoModal] = useState(false);
  const [nombreEmpleadoTurno, setNombreEmpleadoTurno] = useState("");
  const [montoCobroTurnoInput, setMontoCobroTurnoInput] = useState("");

  const [showCierreModal, setShowCierreModal] = useState(false);
  const [efectivoCierreInput, setEfectivoCierreInput] = useState("");
  const [showRazonModal, setShowRazonModal] = useState(false);
  const [razonDiferencia, setRazonDiferencia] = useState("");
  const [resumenCierre, setResumenCierre] = useState<any>(null);

  const [mesaAEditar, setMesaAEditar] = useState<{ id: number; nombre: string; original: string } | null>(null);
  const [nuevoNombreMesa, setNuevoNombreMesa] = useState("");

  const [showCrearMesaModal, setShowCrearMesaModal] = useState(false);
  const [tipoNuevoEspacio, setTipoNuevoEspacio] = useState<"mesa" | "barra">("mesa");
  const [nombreNuevoEspacio, setNombreNuevoEspacio] = useState("");

  const [addedToast, setAddedToast] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cats = new Set(productos.map((p) => p.categoria).filter(Boolean));
    return ["Todos", ...Array.from(cats)];
  }, [productos]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: mesasData } = await supabase.from("mesas").select("*").order("numero", { ascending: true });
      const { data: prodData } = await supabase.from("productos").select("*").order("id", { ascending: true });
      
      const { data: diaData } = await supabase.from("cierres_diarios").select("*").eq("estado", "abierto").order("id", { ascending: false }).limit(1);
      if (diaData && diaData.length > 0) {
        setCierreActivo(diaData[0] as CierreDiario);
      } else {
        setCierreActivo(null);
      }

      if (mesasData && mesasData.length > 0) {
        setMesas(mesasData as Mesa[]);
      }
      if (prodData && prodData.length > 0) setProductos(prodData);
      fetchPedidosCocina();
    } catch (_) {}
    setLoading(false);
  };

  const fetchPedidosCocina = async () => {
    const { data } = await supabase
      .from("pedidos")
      .select("*, mesas!inner(nombre, numero, estado), pedido_items(*, productos(nombre))")
      .eq("estado", "abierto")
      .eq("estado_pedido", "pendiente_servir")
      .order("id", { ascending: true });

    if (data) setPedidosCocina(data as any);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel("pos-realtime-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "mesas" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "pedido_items" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCrearMesa = async () => {
    const maxNumero = mesas.reduce((max, m) => (m.numero > max ? m.numero : max), 0);
    const nuevoNumero = maxNumero + 1;
    
    let nombreFinal = nombreNuevoEspacio.trim();
    if (!nombreFinal) {
      nombreFinal = tipoNuevoEspacio === "barra" ? `Barra ${nuevoNumero}` : `Mesa ${nuevoNumero}`;
    }

    const { error } = await supabase.from("mesas").insert({
      numero: nuevoNumero,
      nombre: nombreFinal,
      estado: "libre",
      capacidad: 4
    });

    if (!error) {
      setShowCrearMesaModal(false);
      setNombreNuevoEspacio("");
      fetchData();
    } else {
      alert("Error al crear el nuevo espacio: " + error.message);
    }
  };

  const handleEliminarMesaAdicional = async (mesaId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("¿Estás seguro de eliminar este espacio adicional?")) {
      await supabase.from("mesas").delete().eq("id", mesaId);
      fetchData();
    }
  };

  const handleOpenEditNombre = (mesa: Mesa, idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const nombreOrig = getNombreOriginal(mesa.numero, idx);
    setMesaAEditar({ id: mesa.id, nombre: mesa.nombre, original: nombreOrig });
    setNuevoNombreMesa(mesa.nombre);
  };

  const handleGuardarNombreMesa = async () => {
    if (!mesaAEditar || !nuevoNombreMesa.trim()) return;
    await supabase.from("mesas").update({ nombre: nuevoNombreMesa.trim() }).eq("id", mesaAEditar.id);
    setMesaAEditar(null);
    setNuevoNombreMesa("");
    fetchData();
  };

  const handleRestablecerNombreMesa = async (mesa: Mesa, idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const nombreOrig = getNombreOriginal(mesa.numero, idx);
    await supabase.from("mesas").update({ nombre: nombreOrig }).eq("id", mesa.id);
    fetchData();
  };

  const handleAdminAccess = () => {
    setShowAdminPinModal(true);
  };

  const handleVerifyPin = () => {
    if (pinInput === "1624") {
      setShowAdminPinModal(false);
      setPinInput("");
      router.push("/admin");
    } else {
      alert("⚠️ Clave de administrador incorrecta.");
      setPinInput("");
    }
  };

  const handleAbrirDia = async () => {
    const monto = parseCurrencyToNumber(montoInicialFormatted);

    const { data, error } = await supabase
      .from("cierres_diarios")
      .insert({
        fecha: fechaApertura,
        monto_inicial: monto,
        monto_cierre_declarado: 0,
        monto_cierre_esperado: 0,
        diferencia: 0,
        razon_diferencia: "",
        es_cuadrado: true,
        total_efectivo: 0,
        total_nequi: 0,
        total_daviplata: 0,
        total_tarjeta: 0,
        total_fiado: 0,
        total_gastos: 0,
        cobro_turno: 0,
        empleado_turno: "",
        estado: "abierto"
      })
      .select()
      .single();

    if (!error && data) {
      setCierreActivo(data as CierreDiario);
      setShowAperturaModal(false);
      setShowAperturaRequeridaModal(false);
      setShowHeaderMenu(false);
      setMontoInicialFormatted("");

      try {
        await supabase.from("caja_estado").upsert({
          id: 1,
          abierta: true,
          monto_inicial: monto,
          fecha_apertura: fechaApertura
        });
      } catch (_) {}

      alert("✅ ¡Día abierto exitosamente!");
    } else {
      console.error("Error al abrir día:", error);
      alert("Error al abrir el día: " + (error?.message || "Verifica permisos de Supabase."));
    }
  };

  const handleAddGastoInsumos = async () => {
    if (!cierreActivo) return alert("Debes abrir el día primero.");
    if (!gastoDesc.trim() || !gastoMonto) return alert("Completa los campos del gasto.");
    const montoVal = parseCurrencyToNumber(gastoMonto);
    const hoy = new Date().toISOString().split("T")[0];

    await supabase.from("gastos").insert({
      cierre_diario_id: cierreActivo.id,
      fecha: hoy,
      descripcion: gastoDesc.trim(),
      monto: montoVal,
      created_at: new Date().toISOString()
    });

    setGastoDesc("");
    setGastoMonto("");
    setShowGastoModal(false);
    setShowHeaderMenu(false);
    alert("✅ Gasto de insumos guardado correctamente.");
  };

  const calcularTotalesTurno = async () => {
    if (!cierreActivo) {
      return {
        tEfectivo: 0, tNequi: 0, tDaviplata: 0, tTarjeta: 0, tFiado: 0,
        tTransferencias: 0, tGastos: 0, baseInicial: 0, cobroTurno: 0, totalCajaEsperado: 0
      };
    }
    
    const { data: ventasDia } = await supabase.from("ventas").select("*").eq("cierre_diario_id", cierreActivo.id);
    const { data: gastosDia } = await supabase.from("gastos").select("*").eq("cierre_diario_id", cierreActivo.id);

    let tEfectivo = 0, tNequi = 0, tDaviplata = 0, tTarjeta = 0, tFiado = 0;

    (ventasDia || []).forEach((v: any) => {
      if (v.desglose_pagos && Array.isArray(v.desglose_pagos) && v.desglose_pagos.length > 0) {
        v.desglose_pagos.forEach((p: any) => {
          if (p.metodo === "efectivo") tEfectivo += p.monto;
          if (p.metodo === "nequi") tNequi += p.monto;
          if (p.metodo === "daviplata") tDaviplata += p.monto;
          if (p.metodo === "tarjeta") tTarjeta += p.monto;
          if (p.metodo === "fiado") tFiado += p.monto;
        });
      } else {
        const m = (v.metodo_pago || "efectivo").toLowerCase();
        if (m.includes("efectivo")) tEfectivo += v.total || 0;
        else if (m.includes("nequi")) tNequi += v.total || 0;
        else if (m.includes("daviplata")) tDaviplata += v.total || 0;
        else if (m.includes("tarjeta")) tTarjeta += v.total || 0;
        else if (m.includes("fiado")) tFiado += v.total || 0;
      }
    });

    const tGastos = (gastosDia || []).reduce((acc: number, g: any) => acc + (g.monto || 0), 0);
    const baseInicial = cierreActivo?.monto_inicial || 0;
    const cobroTurno = parseCurrencyToNumber(montoCobroTurnoInput);

    const totalCajaEsperado = Math.max(0, tEfectivo + baseInicial - tGastos - cobroTurno);

    return {
      tEfectivo,
      tNequi,
      tDaviplata,
      tTarjeta,
      tFiado,
      tTransferencias: tNequi + tDaviplata,
      tGastos,
      baseInicial,
      cobroTurno,
      totalCajaEsperado
    };
  };

  const handleOpenCierreModal = async () => {
    if (!cierreActivo) {
      alert("⚠️ No hay un día abierto actualmente. Abre el día primero.");
      return;
    }
    const res = await calcularTotalesTurno();
    setResumenCierre(res);
    setShowCierreModal(true);
    setShowHeaderMenu(false);
  };

  const handleValidarCierreEfectivo = async () => {
    const valorIngresado = parseCurrencyToNumber(efectivoCierreInput);
    const res = await calcularTotalesTurno();
    setResumenCierre(res);

    if (valorIngresado !== res.totalCajaEsperado) {
      const dif = valorIngresado - res.totalCajaEsperado;
      const tipo = dif > 0 ? "mayor" : "menor";
      if (confirm(`⚠️ El dinero ingresado ($${formatCurrency(valorIngresado)}) es ${tipo} al esperado ($${formatCurrency(res.totalCajaEsperado)}). ¿Deseas ingresar la razón de la diferencia?`)) {
        setShowRazonModal(true);
      }
    } else {
      finalizarCierreDia(valorIngresado, 0, "");
    }
  };

  const finalizarCierreDia = async (declarado: number, diferencia: number, razon: string) => {
    if (!cierreActivo) return;

    const resCalculado = await calcularTotalesTurno();

    const updatePayload = {
      monto_cierre_declarado: declarado,
      monto_cierre_esperado: resCalculado.totalCajaEsperado,
      diferencia: declarado - resCalculado.totalCajaEsperado,
      razon_diferencia: razon,
      es_cuadrado: (declarado - resCalculado.totalCajaEsperado) === 0,
      total_efectivo: resCalculado.tEfectivo,
      total_nequi: resCalculado.tNequi,
      total_daviplata: resCalculado.tDaviplata,
      total_tarjeta: resCalculado.tTarjeta,
      total_fiado: resCalculado.tFiado,
      total_gastos: resCalculado.tGastos,
      cobro_turno: resCalculado.cobroTurno,
      empleado_turno: nombreEmpleadoTurno.trim(),
      estado: "cerrado"
    };

    const { error } = await supabase
      .from("cierres_diarios")
      .update(updatePayload)
      .eq("id", cierreActivo.id);

    if (error) {
      alert("Error al finalizar el cierre de día: " + error.message);
      return;
    }

    try {
      await supabase.from("caja_estado").upsert({
        id: 1,
        abierta: false,
        monto_inicial: 0
      });
    } catch (_) {}

    setCierreActivo(null);
    setShowCierreModal(false);
    setShowRazonModal(false);
    setEfectivoCierreInput("");
    setRazonDiferencia("");
    setMontoCobroTurnoInput("");
    setNombreEmpleadoTurno("");
    alert("🎉 ¡Cierre de día guardado con éxito!");
  };

  const handleSelectMesa = async (mesa: Mesa) => {
    if (vista === "caja" && mesa.estado === "libre") return;

    setSelectedMesa(mesa);
    setCart([]);
    setInitialItemsCount(0);
    setShowCheckout(false);
    setSaleCompleted(false);
    setShowMobileCart(false);
    setPagos([]);
    setMontoIngresado("");
    setEfectivoRecibido("");
    setClienteFiado("");

    const { data: pedido } = await supabase.from("pedidos").select("id").eq("mesa_id", mesa.id).eq("estado", "abierto").single();

    if (pedido) {
      const { data: items } = await supabase.from("pedido_items").select("*, productos(*)").eq("pedido_id", pedido.id);
      if (items) {
        const loadedCart: CartItem[] = items.map((it: any) => ({
          producto: it.productos,
          cantidad: it.cantidad,
          notas: it.notas || "",
          es_adicion: it.es_adicion || false,
        }));
        setCart(loadedCart);
        setInitialItemsCount(loadedCart.reduce((acc, i) => acc + i.cantidad, 0));
      }
    }

    if (vista === "caja" && mesa.estado !== "libre") {
      setShowCheckout(true);
    }
  };

  const addToCart = (producto: Producto) => {
    if (vista === "caja") return;
    
    setAddedToast(`+1 ${producto.nombre}`);
    setTimeout(() => setAddedToast(null), 1400);

    setCart((prev) => {
      const isAdicion = initialItemsCount > 0;
      const existing = prev.find((item) => item.producto.id === producto.id && item.es_adicion === isAdicion);
      if (existing) {
        return prev.map((item) => item.producto.id === producto.id && item.es_adicion === isAdicion ? { ...item, cantidad: item.cantidad + 1 } : item);
      }
      return [...prev, { producto, cantidad: 1, es_adicion: isAdicion }];
    });
  };

  const updateQuantity = (productoId: number, delta: number, esAdicion: boolean = false) => {
    if (vista === "caja") return;
    setCart((prev) =>
      prev.map((item) => {
        if (item.producto.id === productoId && item.es_adicion === esAdicion) {
          const newQty = item.cantidad + delta;
          return newQty > 0 ? { ...item, cantidad: newQty } : null;
        }
        return item;
      }).filter(Boolean) as CartItem[]
    );
  };

  const subtotalAmount = useMemo(() => cart.reduce((acc, item) => acc + item.producto.precio * item.cantidad, 0), [cart]);

  const discountVal = useMemo(() => {
    const val = parseCurrencyToNumber(discountInput);
    return discountType === "porcentaje" ? (subtotalAmount * val) / 100 : val;
  }, [discountInput, discountType, subtotalAmount]);

  const finalTotal = useMemo(() => Math.max(0, subtotalAmount - discountVal), [subtotalAmount, discountVal]);
  const totalPagado = useMemo(() => pagos.reduce((acc, p) => acc + p.monto, 0), [pagos]);
  const saldoPendiente = useMemo(() => Math.max(0, finalTotal - totalPagado), [finalTotal, totalPagado]);

  useEffect(() => {
    if (showCheckout) {
      setMontoIngresado(saldoPendiente > 0 ? formatCurrency(saldoPendiente) : "");
    }
  }, [showCheckout, saldoPendiente]);

  const handlePagoExacto = () => {
    setMontoIngresado(formatCurrency(saldoPendiente));
    if (currentMetodo === "efectivo") {
      setEfectivoRecibido(formatCurrency(saldoPendiente));
    }
  };

  const handleAgregarPago = () => {
    const monto = parseCurrencyToNumber(montoIngresado);
    if (!monto || monto <= 0) return alert("Ingresa un monto válido a pagar.");

    if (currentMetodo === "efectivo") {
      const recibido = parseCurrencyToNumber(efectivoRecibido);
      if (recibido < monto) return alert("El dinero recibido en efectivo es menor al monto asignado.");
      const cambio = recibido - monto;
      setPagos((prev) => [...prev, { metodo: "efectivo", monto, montoEntregadoEfectivo: recibido, cambioEfectivo: cambio }]);
    } else if (currentMetodo === "fiado") {
      if (!clienteFiado.trim()) return alert("Debes indicar el nombre de la persona a la que le vas a fiar.");
      setPagos((prev) => [...prev, { metodo: "fiado", monto, clienteFiado: clienteFiado.trim() }]);
    } else {
      setPagos((prev) => [...prev, { metodo: currentMetodo, monto }]);
    }

    setMontoIngresado("");
    setEfectivoRecibido("");
  };

  const handleEliminarPago = (index: number) => {
    setPagos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveOrder = async () => {
    if (!selectedMesa || vista === "caja") return;

    if (!cierreActivo) {
      setShowAperturaRequeridaModal(true);
      return;
    }

    await supabase.from("mesas").update({ estado: "pendiente_servir" }).eq("id", selectedMesa.id);

    let { data: pedido } = await supabase.from("pedidos").select("id").eq("mesa_id", selectedMesa.id).eq("estado", "abierto").single();

    if (!pedido) {
      const { data: newPedido } = await supabase
        .from("pedidos")
        .insert({ mesa_id: selectedMesa.id, total: subtotalAmount, estado: "abierto", estado_pedido: "pendiente_servir" })
        .select().single();
      pedido = newPedido;
    } else {
      await supabase.from("pedidos").update({ total: subtotalAmount, estado_pedido: "pendiente_servir" }).eq("id", pedido.id);
      await supabase.from("pedido_items").delete().eq("pedido_id", pedido.id);
    }

    if (pedido && cart.length > 0) {
      const itemsToInsert = cart.map((item) => ({
        pedido_id: pedido.id,
        producto_id: item.producto.id,
        cantidad: item.cantidad,
        precio_unitario: item.producto.precio,
        es_adicion: item.es_adicion || false,
      }));
      await supabase.from("pedido_items").insert(itemsToInsert);
    }

    fetchData();
    setSelectedMesa(null);
  };

  const handleEntregarAMesa = async (mesaId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("mesas").update({ estado: "servido" }).eq("id", mesaId);
    await supabase.from("pedidos").update({ estado_pedido: "servido" }).eq("mesa_id", mesaId).eq("estado", "abierto");
    fetchData();
  };

  const handleCocinaListo = async (pedidoId: number, mesaId: number) => {
    await supabase.from("pedidos").update({ estado_pedido: "preparado" }).eq("id", pedidoId);
    await supabase.from("mesas").update({ estado: "preparado" }).eq("id", mesaId);
    fetchData();
  };

  const handleCancelarComanda = async (pedidoId: number, mesaId: number) => {
    if (confirm("¿Estás seguro de eliminar/cancelar esta comanda? La mesa quedará libre.")) {
      await supabase.from("pedido_items").delete().eq("pedido_id", pedidoId);
      await supabase.from("pedidos").delete().eq("id", pedidoId);
      await supabase.from("mesas").update({ estado: "libre" }).eq("id", mesaId);
      fetchData();
    }
  };

  const handleFinalizeSale = async () => {
    if (!selectedMesa) return;
    if (!cierreActivo) return alert("⚠️ Se requiere un día abierto para finalizar ventas.");
    if (saldoPendiente > 0) return alert(`No se puede liberar la mesa. Aún hay un saldo pendiente de $${formatCurrency(saldoPendiente)}`);

    const itemsSummary = cart.map((i) => ({ nombre: i.producto.nombre, cantidad: i.cantidad, precio: i.producto.precio }));
    const fiadoItem = pagos.find((p) => p.metodo === "fiado");

    for (const item of cart) {
      if (item.producto.id) {
        const stockActual = item.producto.stock ?? 50;
        const nuevoStock = Math.max(0, stockActual - item.cantidad);
        await supabase
          .from("productos")
          .update({ stock: nuevoStock, disponible: nuevoStock > 0 })
          .eq("id", item.producto.id);
      }
    }

    await supabase.from("ventas").insert({
      cierre_diario_id: cierreActivo.id,
      mesa_id: selectedMesa.id,
      numero_mesa: selectedMesa.numero,
      metodo_pago: pagos.map((p) => p.metodo).join(", "),
      desglose_pagos: pagos,
      cliente_nombre: fiadoItem ? fiadoItem.clienteFiado : null,
      subtotal: subtotalAmount,
      descuento: discountVal,
      total: finalTotal,
      items_detalle: itemsSummary,
    });

    const idxMesa = mesas.findIndex((m) => m.id === selectedMesa.id);
    const nombreOriginal = idxMesa !== -1 ? getNombreOriginal(selectedMesa.numero, idxMesa) : selectedMesa.nombre;

    await supabase.from("pedidos").update({ estado: "pagado", estado_pedido: "servido" }).eq("mesa_id", selectedMesa.id).eq("estado", "abierto");
    await supabase.from("mesas").update({ estado: "libre", nombre: nombreOriginal }).eq("id", selectedMesa.id);

    setSaleCompleted(true);
    fetchData();
  };

  const filteredProducts = productos.filter((p) => {
    const matchesCat = selectedCategory === "Todos" || p.categoria === selectedCategory;
    const matchesSearch = p.nombre.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const cartIniciales = useMemo(() => cart.filter((i) => !i.es_adicion), [cart]);
  const cartAdiciones = useMemo(() => cart.filter((i) => i.es_adicion), [cart]);

  const mesasPrincipales = useMemo(() => mesas.slice(0, 7), [mesas]);
  const mesasAdicionales = useMemo(() => mesas.slice(7), [mesas]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans antialiased flex flex-col selection:bg-pink-500 selection:text-white relative">
      {addedToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-500 text-slate-950 font-black px-4 py-2 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.7)] flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-slate-950" />
          <span>{addedToast}</span>
        </div>
      )}

      {/* HEADER */}
      <header className="shrink-0 bg-slate-900/95 backdrop-blur-md border-b border-pink-500/30 px-4 sm:px-8 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xl z-40">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-600 p-1 flex items-center justify-center text-white shadow-[0_0_20px_rgba(236,72,153,0.5)]">
            <img src="/cafe.png" alt="Logo Café" className="w-full h-full object-contain rounded-xl" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-300 uppercase">
              Anti Café POS
            </h1>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-pink-400" /> Control Integral de Servicio
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800/90 w-full md:w-auto justify-center flex-wrap relative">
          <button
            onClick={() => { setVista("caja"); setSelectedMesa(null); }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              vista === "caja" ? "bg-pink-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.5)]" : "text-slate-400 hover:text-white"
            }`}
          >
            <LayoutGrid className="w-4 h-4" /> CAJA
          </button>

          <button
            onClick={() => { setVista("mesero"); setSelectedMesa(null); }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              vista === "mesero" ? "bg-pink-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.5)]" : "text-slate-400 hover:text-white"
            }`}
          >
            <ShoppingBag className="w-4 h-4" /> MESERO
          </button>

          <button
            onClick={() => { setVista("cocina"); setSelectedMesa(null); }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer relative ${
              vista === "cocina" ? "bg-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.5)]" : "text-slate-400 hover:text-white"
            }`}
          >
            <ChefHat className="w-4 h-4" /> COCINA
            {pedidosCocina.length > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping absolute -top-1 -right-1" />
            )}
          </button>

          <button
            onClick={handleAdminAccess}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all cursor-pointer active:scale-95"
          >
            <ShieldCheck className="w-4 h-4" /> ADMIN
          </button>

          <div className="relative">
            <button
              onClick={() => setShowHeaderMenu(!showHeaderMenu)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              title="Más Opciones"
            >
              <MoreVertical className="w-5 h-5 text-pink-400" />
            </button>

            {showHeaderMenu && (
              <div className="absolute right-0 mt-2 bg-slate-900 border border-pink-500/40 p-2 rounded-2xl shadow-2xl flex flex-col gap-1.5 w-52 z-50">
                <button
                  onClick={() => { setShowGastoModal(true); setShowHeaderMenu(false); }}
                  className="px-3 py-2 text-left text-xs font-black text-slate-200 hover:bg-pink-500 hover:text-white rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 text-rose-400" /> 1. Compra de Insumos
                </button>
                <button
                  onClick={async () => {
                    const res = await calcularTotalesTurno();
                    setResumenCierre(res);
                    setShowCobroTurnoModal(true);
                    setShowHeaderMenu(false);
                  }}
                  className="px-3 py-2 text-left text-xs font-black text-slate-200 hover:bg-pink-500 hover:text-white rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                >
                  <DollarSign className="w-4 h-4 text-cyan-400" /> 2. Cobro de Turno
                </button>
                <button
                  onClick={handleOpenCierreModal}
                  className="px-3 py-2 text-left text-xs font-black text-slate-200 hover:bg-pink-500 hover:text-white rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Lock className="w-4 h-4 text-amber-400" /> 3. Cierre de Día
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* VISTA COCINA */}
      {vista === "cocina" && (
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-7xl mx-auto w-full">
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 mb-6">
            <ChefHat className="w-7 h-7 text-amber-400" /> Pedidos de Cocina ({pedidosCocina.length})
          </h2>

          {pedidosCocina.length === 0 ? (
            <div className="text-center py-20 text-slate-500 font-bold bg-slate-900/40 rounded-3xl border border-slate-800 p-8">
              🍳 No hay comandas pendientes en cocina.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {pedidosCocina.map((p) => {
                const entredados = p.pedido_items?.filter((i) => !i.es_adicion) || [];
                const adiciones = p.pedido_items?.filter((i) => i.es_adicion) || [];

                return (
                  <div key={p.id} className="bg-slate-900 border-2 border-amber-500/60 p-6 rounded-3xl flex flex-col justify-between shadow-2xl relative">
                    <div>
                      <div className="flex justify-between items-center pb-3 border-b border-slate-800 pr-8">
                        <h3 className="font-black text-xl text-white">{p.mesas?.nombre || `Espacio ${p.mesa_id}`}</h3>
                        <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          {new Date(p.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <button
                        onClick={() => handleCancelarComanda(p.id, p.mesa_id)}
                        className="absolute top-5 right-5 p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="my-5 space-y-4">
                        {entredados.length > 0 && adiciones.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-[10px] font-black uppercase text-emerald-400 block tracking-wider">
                              ✅ Productos ya entregados:
                            </span>
                            {entredados.map((it) => (
                              <div key={it.id} className="flex justify-between items-center text-xs font-bold p-2.5 rounded-xl border bg-emerald-950/20 border-emerald-500/40 text-emerald-300 opacity-70">
                                <span className="flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  {it.cantidad}x {it.productos?.nombre}
                                </span>
                                <span className="font-mono text-[11px]">${formatCurrency(it.precio_unitario * it.cantidad)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="space-y-2">
                          {adiciones.length > 0 && (
                            <span className="text-[10px] font-black uppercase text-rose-400 block tracking-wider">
                              🚨 Productos a añadir:
                            </span>
                          )}

                          {(adiciones.length > 0 ? adiciones : p.pedido_items)?.map((it) => (
                            <div key={it.id} className="flex justify-between items-center text-sm font-bold p-3 rounded-xl border bg-slate-950/80 border-slate-800 text-slate-200 shadow-md">
                              <span className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-400" />
                                {it.cantidad}x {it.productos?.nombre}
                              </span>
                              <span className="font-mono text-xs text-slate-400">${formatCurrency(it.precio_unitario * it.cantidad)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 space-y-3">
                      <div className="flex justify-between items-center text-sm font-black">
                        <span className="text-slate-400">TOTAL COMANDA:</span>
                        <span className="font-mono text-emerald-400 text-base">${formatCurrency(p.total)}</span>
                      </div>

                      <button
                        onClick={() => handleCocinaListo(p.id, p.mesa_id)}
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm uppercase rounded-2xl cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all active:scale-95"
                      >
                        <Check className="w-5 h-5" /> LISTO
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* VISTAS CAJA Y MESERO */}
      {vista !== "cocina" && (
        <>
          {!selectedMesa ? (
            <main className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
              <div className={`p-4 rounded-3xl border flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl transition-all ${
                cierreActivo 
                  ? "bg-slate-900/90 border-emerald-500/40 text-emerald-300"
                  : "bg-amber-950/60 border-amber-500/80 text-amber-200 shadow-[0_0_25px_rgba(245,158,11,0.2)]"
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    cierreActivo ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400 animate-pulse"
                  }`}>
                    {cierreActivo ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                  </div>
                  <div>
                    <h4 className="font-black text-sm sm:text-base uppercase tracking-wider">
                      {cierreActivo ? "Jornada Abierta" : "⚠️ Día Sin Abrir"}
                    </h4>
                    <p className="text-xs font-bold opacity-80">
                      {cierreActivo 
                        ? `Apertura registrada con base de $${formatCurrency(cierreActivo.monto_inicial)}`
                        : "Debes abrir el día e ingresar la base inicial para operar y enviar pedidos."
                      }
                    </p>
                  </div>
                </div>

                {!cierreActivo && (
                  <button
                    onClick={() => setShowAperturaModal(true)}
                    className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs uppercase rounded-2xl shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-all cursor-pointer active:scale-95 shrink-0 flex items-center justify-center gap-2"
                  >
                    <Calendar className="w-4 h-4" /> Realizar Apertura
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
                {mesasPrincipales.map((mesa, idx) => {
                  const isLibre = mesa.estado === "libre";
                  const isPendServir = mesa.estado === "pendiente_servir";
                  const isPreparado = mesa.estado === "preparado";
                  const isServido = mesa.estado === "servido";

                  const nombreOriginal = getNombreOriginal(mesa.numero, idx);
                  const tieneNombrePersonalizado = mesa.nombre !== nombreOriginal;

                  return (
                    <div
                      key={mesa.id}
                      onClick={() => handleSelectMesa(mesa)}
                      className={`group relative rounded-3xl p-5 border-2 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between h-64 sm:h-72 shadow-2xl ${
                        isLibre
                          ? "bg-slate-900/90 border-emerald-500/50 hover:border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)]"
                          : isPendServir
                          ? "bg-amber-950/40 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:shadow-[0_0_30px_rgba(245,158,11,0.4)]"
                          : isPreparado
                          ? "bg-purple-950/50 border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.5)] animate-pulse hover:shadow-[0_0_40px_rgba(168,85,247,0.7)]"
                          : "bg-cyan-950/40 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)]"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-1 z-10">
                        <div className="flex items-center gap-1.5 flex-wrap max-w-[65%]">
                          <h3 className="font-black text-lg sm:text-xl text-white tracking-wide truncate">
                            {mesa.nombre}
                          </h3>
                          <button
                            onClick={(e) => handleOpenEditNombre(mesa, idx, e)}
                            className="p-1 rounded-lg bg-slate-800/80 hover:bg-pink-500 text-slate-300 hover:text-white transition-all cursor-pointer shrink-0"
                            title="Cambiar/Reservar Nombre"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {tieneNombrePersonalizado && (
                            <button
                              onClick={(e) => handleRestablecerNombreMesa(mesa, idx, e)}
                              className="p-1 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white transition-all cursor-pointer shrink-0"
                              title={`Restablecer a: ${nombreOriginal}`}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <span className={`text-[9px] sm:text-[10px] font-black px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full uppercase flex items-center gap-1 tracking-wider shadow-md shrink-0 ${
                          isLibre
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : isPendServir
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : isPreparado
                            ? "bg-purple-500/30 text-purple-200 border border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                            : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                        }`}>
                          {isLibre && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                          {isPendServir && <Clock className="w-3 h-3 text-amber-400" />}
                          {isPreparado && <Sparkle className="w-3 h-3 text-purple-300 animate-spin" />}
                          {isServido && <ChefHat className="w-3 h-3 text-cyan-400" />}
                          {mesa.estado.replace("_", " ")}
                        </span>
                      </div>

                      <div className="flex-1 flex flex-col justify-center items-center my-1 relative z-0">
                        <img 
                          src={isLibre ? "/mesa1.png" : "/mesa2.png"} 
                          alt={mesa.nombre} 
                          className="h-20 sm:h-22 w-auto object-contain opacity-85 group-hover:scale-105 transition-transform duration-300" 
                        />
                        <span className={`text-xl sm:text-2xl font-black uppercase tracking-widest mt-1 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] ${
                          isLibre 
                            ? "text-emerald-400" 
                            : isPendServir 
                            ? "text-amber-400" 
                            : isPreparado 
                            ? "text-purple-300 animate-bounce" 
                            : "text-cyan-300"
                        }`}>
                          {isLibre ? "LIBRE" : isPendServir ? "COCINA" : isPreparado ? "PREPARADO" : "SERVIDO"}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 z-10">
                        {vista === "caja" ? (
                          <button
                            className={`w-full py-2 font-black text-xs uppercase rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                              isLibre
                                ? "bg-slate-950 text-slate-600 border-slate-800/80 cursor-not-allowed"
                                : "bg-pink-500/20 text-pink-300 border-pink-500/50 hover:bg-pink-500 hover:text-white shadow-[0_0_15px_rgba(236,72,153,0.3)] active:scale-95 cursor-pointer"
                            }`}
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            {isLibre ? "Disponible" : "Cobrar Mesa"}
                          </button>
                        ) : (
                          <div>
                            {isPreparado ? (
                              <button
                                onClick={(e) => handleEntregarAMesa(mesa.id, e)}
                                className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.5)] flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                              >
                                <Send className="w-3.5 h-3.5" /> Entregar
                              </button>
                            ) : (
                              <div className={`text-[11px] font-black uppercase text-center py-1.5 rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                                isLibre 
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 group-hover:bg-emerald-500 group-hover:text-slate-950" 
                                  : isServido 
                                  ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30 group-hover:bg-cyan-500 group-hover:text-slate-950"
                                  : "bg-amber-500/10 text-amber-300 border-amber-500/30 group-hover:bg-amber-500 group-hover:text-slate-950"
                              }`}>
                                {isLibre ? (
                                  <><Plus className="w-3.5 h-3.5" /> Tomar Pedido</>
                                ) : isServido ? (
                                  <><Plus className="w-3.5 h-3.5" /> Agregar Adición</>
                                ) : (
                                  <><Receipt className="w-3.5 h-3.5" /> Ver / Modificar</>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div
                  onClick={() => setShowCrearMesaModal(true)}
                  className="group relative rounded-3xl p-5 border-2 border-dashed border-pink-500/60 bg-gradient-to-br from-slate-900/90 via-purple-950/20 to-pink-950/30 hover:border-pink-400 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col items-center justify-center h-64 sm:h-72 shadow-2xl hover:shadow-[0_0_30px_rgba(236,72,153,0.35)] active:scale-95 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-pink-500/20 border border-pink-500/50 flex items-center justify-center text-pink-400 group-hover:scale-110 group-hover:bg-pink-500 group-hover:text-white transition-all shadow-[0_0_15px_rgba(236,72,153,0.4)] mb-3">
                    <PlusCircle className="w-8 h-8" />
                  </div>
                  <h3 className="font-black text-base sm:text-lg text-white uppercase tracking-wider">
                    Crear Espacio
                  </h3>
                  <p className="text-[11px] font-bold text-pink-300/80 mt-1 max-w-[160px]">
                    Mesa o Barra Adicional
                  </p>
                  <span className="mt-4 px-3 py-1 bg-pink-500/20 border border-pink-500/40 text-pink-300 text-[10px] font-black uppercase rounded-full">
                    + Añadir evento
                  </span>
                </div>

                {mesasAdicionales.map((mesa, idx) => {
                  const actualIdx = idx + 7;
                  const isLibre = mesa.estado === "libre";
                  const isPendServir = mesa.estado === "pendiente_servir";
                  const isPreparado = mesa.estado === "preparado";
                  const isServido = mesa.estado === "servido";

                  return (
                    <div
                      key={mesa.id}
                      onClick={() => handleSelectMesa(mesa)}
                      className={`group relative rounded-3xl p-5 border-2 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between h-64 sm:h-72 shadow-2xl ${
                        isLibre
                          ? "bg-slate-900/90 border-emerald-500/50 hover:border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)]"
                          : isPendServir
                          ? "bg-amber-950/40 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:shadow-[0_0_30px_rgba(245,158,11,0.4)]"
                          : isPreparado
                          ? "bg-purple-950/50 border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.5)] animate-pulse hover:shadow-[0_0_40px_rgba(168,85,247,0.7)]"
                          : "bg-cyan-950/40 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)]"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-1 z-10">
                        <div className="flex items-center gap-1.5 flex-wrap max-w-[65%]">
                          <h3 className="font-black text-lg sm:text-xl text-white tracking-wide truncate">
                            {mesa.nombre}
                          </h3>
                          <button
                            onClick={(e) => handleOpenEditNombre(mesa, actualIdx, e)}
                            className="p-1 rounded-lg bg-slate-800/80 hover:bg-pink-500 text-slate-300 hover:text-white transition-all cursor-pointer shrink-0"
                            title="Cambiar Nombre"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {isLibre && (
                            <button
                              onClick={(e) => handleEliminarMesaAdicional(mesa.id, e)}
                              className="p-1 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white transition-all cursor-pointer shrink-0"
                              title="Eliminar Espacio Adicional"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <span className={`text-[9px] sm:text-[10px] font-black px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full uppercase flex items-center gap-1 tracking-wider shadow-md shrink-0 ${
                          isLibre
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : isPendServir
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : isPreparado
                            ? "bg-purple-500/30 text-purple-200 border border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                            : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                        }`}>
                          {isLibre && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                          {isPendServir && <Clock className="w-3 h-3 text-amber-400" />}
                          {isPreparado && <Sparkle className="w-3 h-3 text-purple-300 animate-spin" />}
                          {isServido && <ChefHat className="w-3 h-3 text-cyan-400" />}
                          {mesa.estado.replace("_", " ")}
                        </span>
                      </div>

                      <div className="flex-1 flex flex-col justify-center items-center my-1 relative z-0">
                        <img 
                          src={isLibre ? "/mesa1.png" : "/mesa2.png"} 
                          alt={mesa.nombre} 
                          className="h-20 sm:h-22 w-auto object-contain opacity-85 group-hover:scale-105 transition-transform duration-300" 
                        />
                        <span className={`text-xl sm:text-2xl font-black uppercase tracking-widest mt-1 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] ${
                          isLibre 
                            ? "text-emerald-400" 
                            : isPendServir 
                            ? "text-amber-400" 
                            : isPreparado 
                            ? "text-purple-300 animate-bounce" 
                            : "text-cyan-300"
                        }`}>
                          {isLibre ? "LIBRE" : isPendServir ? "COCINA" : isPreparado ? "PREPARADO" : "SERVIDO"}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 z-10">
                        {vista === "caja" ? (
                          <button
                            className={`w-full py-2 font-black text-xs uppercase rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                              isLibre
                                ? "bg-slate-950 text-slate-600 border-slate-800/80 cursor-not-allowed"
                                : "bg-pink-500/20 text-pink-300 border-pink-500/50 hover:bg-pink-500 hover:text-white shadow-[0_0_15px_rgba(236,72,153,0.3)] active:scale-95 cursor-pointer"
                            }`}
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            {isLibre ? "Disponible" : "Cobrar Mesa"}
                          </button>
                        ) : (
                          <div>
                            {isPreparado ? (
                              <button
                                onClick={(e) => handleEntregarAMesa(mesa.id, e)}
                                className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.5)] flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                              >
                                <Send className="w-3.5 h-3.5" /> Entregar
                              </button>
                            ) : (
                              <div className={`text-[11px] font-black uppercase text-center py-1.5 rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                                isLibre 
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 group-hover:bg-emerald-500 group-hover:text-slate-950" 
                                  : isServido 
                                  ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30 group-hover:bg-cyan-500 group-hover:text-slate-950"
                                  : "bg-amber-500/10 text-amber-300 border-amber-500/30 group-hover:bg-amber-500 group-hover:text-slate-950"
                              }`}>
                                {isLibre ? (
                                  <><Plus className="w-3.5 h-3.5" /> Tomar Pedido</>
                                ) : isServido ? (
                                  <><Plus className="w-3.5 h-3.5" /> Agregar Adición</>
                                ) : (
                                  <><Receipt className="w-3.5 h-3.5" /> Ver / Modificar</>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </main>
          ) : (
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative h-full">
              <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                <div className="shrink-0 bg-slate-900 border-b border-slate-800 p-3 sm:p-4 shadow-md space-y-2 z-20">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedMesa(null)}
                      className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-black text-slate-300 flex items-center gap-1.5 cursor-pointer hover:bg-slate-800 transition-all shrink-0"
                    >
                      <ArrowLeft className="w-4 h-4 text-pink-400" /> <span className="hidden sm:inline">Volver a</span> Mesas
                    </button>

                    <div className="relative flex-1 max-w-md">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Buscar producto..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-pink-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase whitespace-nowrap transition-all border cursor-pointer ${
                          selectedCategory === cat
                            ? "bg-pink-500 text-white border-pink-400 shadow-sm"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {vista === "caja" && (
                    <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-[11px] font-bold flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5" /> Modo Caja: Vista de solo lectura. Para modificar cambia a vista Mesero.
                    </div>
                  )}
                </div>

                <div className="flex-1 p-3 sm:p-6 overflow-y-auto pb-28 lg:pb-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filteredProducts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => addToCart(p)}
                        className={`bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl flex flex-col justify-between transition-all duration-150 select-none ${
                          vista === "mesero" 
                            ? "cursor-pointer hover:border-pink-500/50 active:scale-90 active:border-pink-400 active:bg-pink-500/20 shadow-lg" 
                            : "opacity-60 cursor-not-allowed"
                        }`}
                      >
                        <div>
                          <span className="text-[8px] font-black uppercase text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full">{p.categoria}</span>
                          <h4 className="font-black text-xs sm:text-sm text-white mt-1">{p.nombre}</h4>
                          <p className="text-[9px] font-mono text-slate-400 mt-0.5">Stock: {p.stock ?? 50}</p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-800/80 flex justify-between items-center">
                          <span className="font-black text-xs sm:text-sm text-emerald-400 font-mono">${formatCurrency(p.precio)}</span>
                          {vista === "mesero" && (
                            <span className="w-6 h-6 rounded-lg bg-pink-500/20 text-pink-400 font-black flex items-center justify-center text-xs transition-transform active:scale-125">+</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="fixed lg:relative bottom-0 left-0 right-0 z-30 bg-slate-900/95 border-t lg:border-l border-slate-800 shadow-2xl transition-all duration-300">
                <div className="lg:hidden p-3.5 bg-slate-950 flex items-center justify-between border-b border-slate-800">
                  <div>
                    <span className="text-[10px] font-black uppercase text-pink-400 block">{selectedMesa.nombre}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-white font-mono">${formatCurrency(subtotalAmount)}</span>
                      <span className="text-[10px] text-slate-400">({cart.reduce((a, b) => a + b.cantidad, 0)} items)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowMobileCart(!showMobileCart)}
                      className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-pink-400 hover:bg-slate-800 transition-all flex items-center justify-center cursor-pointer"
                    >
                      {showMobileCart ? <ChevronDown className="w-5 h-5 text-pink-400" /> : <ChevronUp className="w-5 h-5 text-pink-400" />}
                    </button>

                    {vista === "mesero" ? (
                      <button
                        onClick={handleSaveOrder}
                        disabled={cart.length === 0}
                        className={`px-3.5 py-2.5 font-black text-xs uppercase rounded-xl flex items-center gap-1.5 transition-all ${
                          cart.length === 0 ? "bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md cursor-pointer active:scale-95"
                        }`}
                      >
                        <ChefHat className="w-4 h-4" /> Cocina
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowCheckout(true)}
                        disabled={cart.length === 0}
                        className={`px-3.5 py-2.5 font-black text-xs uppercase rounded-xl flex items-center gap-1.5 transition-all ${
                          cart.length === 0 ? "bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-pink-500 hover:bg-pink-400 text-white shadow-md cursor-pointer active:scale-95"
                        }`}
                      >
                        <CreditCard className="w-4 h-4" /> Cobrar
                      </button>
                    )}
                  </div>
                </div>

                <div className={`${showMobileCart ? "block" : "hidden lg:block"} w-full lg:w-96 p-4 sm:p-5 flex flex-col justify-between max-h-[60vh] lg:max-h-none overflow-y-auto`}>
                  <div>
                    <h2 className="hidden lg:flex font-black text-lg text-white items-center gap-2 pb-3 border-b border-slate-800">
                      <Receipt className="w-5 h-5 text-pink-400" /> {selectedMesa.nombre}
                    </h2>
                    
                    <div className="my-3 space-y-2 max-h-[40vh] lg:max-h-[50vh] overflow-y-auto pr-1">
                      {cart.length === 0 ? (
                        <p className="text-xs text-slate-500 font-bold py-4 text-center">No hay productos añadidos</p>
                      ) : (
                        cart.map((item, idx) => (
                          <div key={`${item.producto.id}-${item.es_adicion ? "adicion" : "normal"}-${idx}`} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                            <div>
                              <h5 className="font-black text-xs text-slate-100 flex items-center gap-1.5">
                                {item.producto.nombre}
                                {item.es_adicion && <span className="text-[8px] bg-rose-500/20 text-rose-400 border border-rose-500/40 px-1 py-0.2 rounded font-bold">ADICIÓN</span>}
                              </h5>
                              <p className="text-[10px] text-slate-400 font-mono">${formatCurrency(item.producto.precio)}</p>
                            </div>
                            {vista === "mesero" ? (
                              <div className="flex items-center gap-2">
                                <button onClick={() => updateQuantity(item.producto.id, -1, item.es_adicion)} className="w-6 h-6 rounded-lg bg-slate-800 text-white font-black flex items-center justify-center cursor-pointer"><Minus className="w-3 h-3" /></button>
                                <span className="font-black text-xs text-white">{item.cantidad}</span>
                                <button onClick={() => updateQuantity(item.producto.id, 1, item.es_adicion)} className="w-6 h-6 rounded-lg bg-slate-800 text-white font-black flex items-center justify-center cursor-pointer"><Plus className="w-3 h-3" /></button>
                              </div>
                            ) : (
                              <span className="font-black text-xs text-slate-300">x{item.cantidad}</span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 space-y-3">
                    <div className="hidden lg:flex justify-between text-lg font-black text-white">
                      <span>TOTAL</span>
                      <span className="font-mono text-emerald-400">${formatCurrency(subtotalAmount)}</span>
                    </div>

                    {vista === "mesero" ? (
                      <button onClick={handleSaveOrder} disabled={cart.length === 0} className="hidden lg:flex w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-2xl shadow items-center justify-center gap-2 cursor-pointer active:scale-95">
                        <ChefHat className="w-5 h-5" /> Enviar a Cocina
                      </button>
                    ) : (
                      <button onClick={() => setShowCheckout(true)} disabled={cart.length === 0} className="hidden lg:flex w-full py-3.5 bg-pink-500 hover:bg-pink-400 text-white font-black text-xs uppercase rounded-2xl shadow items-center justify-center gap-2 cursor-pointer active:scale-95">
                        <CreditCard className="w-5 h-5" /> Ir al Módulo de Cobro
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL CREAR MESA O BARRA */}
      {showCrearMesaModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-pink-500/40 rounded-3xl p-6 max-w-xs w-full shadow-2xl relative space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-pink-400" /> Crear Nuevo Espacio
              </h3>
              <button onClick={() => setShowCrearMesaModal(false)} className="p-1 text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1.5">Tipo de Espacio:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTipoNuevoEspacio("mesa")}
                    className={`py-2 rounded-xl text-xs font-black uppercase transition-all border cursor-pointer ${
                      tipoNuevoEspacio === "mesa" ? "bg-pink-500 text-white border-pink-400" : "bg-slate-950 text-slate-400 border-slate-800"
                    }`}
                  >
                    Mesa
                  </button>
                  <button
                    onClick={() => setTipoNuevoEspacio("barra")}
                    className={`py-2 rounded-xl text-xs font-black uppercase transition-all border cursor-pointer ${
                      tipoNuevoEspacio === "barra" ? "bg-pink-500 text-white border-pink-400" : "bg-slate-950 text-slate-400 border-slate-800"
                    }`}
                  >
                    Barra
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Nombre Personalizado (Opcional):</label>
                <input
                  type="text"
                  placeholder={tipoNuevoEspacio === "barra" ? "Ej: Barra Auxiliar..." : "Ej: Mesa Evento 1..."}
                  value={nombreNuevoEspacio}
                  onChange={(e) => setNombreNuevoEspacio(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-pink-500"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowCrearMesaModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black text-xs uppercase rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleCrearMesa}
                className="flex-1 py-2.5 bg-pink-500 hover:bg-pink-400 text-white font-black text-xs uppercase rounded-xl shadow-lg transition-all cursor-pointer active:scale-95"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RENOMBRAR MESA */}
      {mesaAEditar && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-pink-500/40 rounded-3xl p-6 max-w-xs w-full shadow-2xl relative space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-pink-400" /> Renombrar Espacio
              </h3>
              <button onClick={() => setMesaAEditar(null)} className="p-1 text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Nombre o Reserva de la Mesa:</label>
              <input
                type="text"
                placeholder="Ej: Mesa de Juan, Reserva 4pm..."
                value={nuevoNombreMesa}
                onChange={(e) => setNuevoNombreMesa(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-pink-500"
              />
              <span className="text-[10px] text-slate-500 font-bold block mt-1">Nombre por defecto: {mesaAEditar.original}</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setMesaAEditar(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black text-xs uppercase rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarNombreMesa}
                className="flex-1 py-2.5 bg-pink-500 hover:bg-pink-400 text-white font-black text-xs uppercase rounded-xl shadow-lg transition-all cursor-pointer active:scale-95"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADVERTENCIA APERTURA REQUERIDA */}
      {showAperturaRequeridaModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/50 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            
            <div>
              <h3 className="font-black text-lg text-white uppercase tracking-wider">Apertura de Día Requerida</h3>
              <p className="text-xs text-slate-300 font-bold mt-1">
                No has realizado la apertura del día. Debes definir el saldo inicial de caja para poder registrar comandas.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={() => setShowAperturaRequeridaModal(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black text-xs uppercase rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowAperturaRequeridaModal(false);
                  setShowAperturaModal(true);
                }}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase rounded-xl shadow-lg transition-all cursor-pointer active:scale-95"
              >
                Hacer Apertura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CLAVE ADMIN */}
      {showAdminPinModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xs w-full shadow-2xl relative space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-pink-400" /> Acceso Administrador
              </h3>
              <button onClick={() => setShowAdminPinModal(false)} className="p-1 text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Ingresa el PIN de Acceso:</label>
              <input
                type="password"
                placeholder="****"
                maxLength={4}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-center text-lg font-black tracking-widest text-white focus:outline-none focus:border-pink-500"
              />
            </div>
            <button
              onClick={handleVerifyPin}
              className="w-full py-3 bg-pink-500 hover:bg-pink-400 text-white font-black text-xs uppercase rounded-xl transition-all cursor-pointer"
            >
              Ingresar al Panel
            </button>
          </div>
        </div>
      )}

      {/* MODAL APERTURA DE DÍA */}
      {showAperturaModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" /> Apertura de Día
              </h3>
              <button onClick={() => setShowAperturaModal(false)} className="p-1 text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Fecha del Día Actual:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    disabled={!editFecha}
                    value={fechaApertura}
                    onChange={(e) => setFechaApertura(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white disabled:opacity-70"
                  />
                  <button
                    onClick={() => setEditFecha(!editFecha)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-pink-400 rounded-xl cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">¿Con cuánta plata iniciamos el día?</label>
                <input
                  type="text"
                  placeholder="Ej: 50.000"
                  value={montoInicialFormatted}
                  onChange={(e) => setMontoInicialFormatted(formatCurrency(e.target.value))}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-black text-emerald-400 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            <button
              onClick={handleAbrirDia}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase rounded-xl transition-all cursor-pointer shadow-lg active:scale-95"
            >
              Aceptar e Iniciar Jornada
            </button>
          </div>
        </div>
      )}

      {/* MODAL COMPRA INSUMOS */}
      {showGastoModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-rose-400" /> Registrar Compra de Insumos
              </h3>
              <button onClick={() => setShowGastoModal(false)} className="p-1 text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Descripción del Insumo / Producto:</label>
                <input
                  type="text"
                  placeholder="Ej: Leche, Vasos, Café..."
                  value={gastoDesc}
                  onChange={(e) => setGastoDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Monto Pagado ($):</label>
                <input
                  type="text"
                  placeholder="Ej: 25.000"
                  value={gastoMonto}
                  onChange={(e) => setGastoMonto(formatCurrency(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-rose-400 font-mono"
                />
              </div>
            </div>

            <button
              onClick={handleAddGastoInsumos}
              className="w-full py-3 bg-rose-500 hover:bg-rose-400 text-white font-black text-xs uppercase rounded-xl transition-all cursor-pointer"
            >
              Guardar Insumo
            </button>
          </div>
        </div>
      )}

      {/* MODAL COBRO DE TURNO MODIFICADO */}
      {showCobroTurnoModal && resumenCierre && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-cyan-400" /> Cobro de Turno / Empleado
              </h3>
              <button onClick={() => setShowCobroTurnoModal(false)} className="p-1 text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-cyan-400" /> Nombre del Empleado / Mesero:
                </label>
                <input
                  type="text"
                  placeholder="Ej: Laura, Andrés..."
                  value={nombreEmpleadoTurno}
                  onChange={(e) => setNombreEmpleadoTurno(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1 flex items-center gap-1">
                  <Calculator className="w-3.5 h-3.5 text-cyan-400" /> Monto a Retirar / Pagar Turno ($):
                </label>
                <input
                  type="text"
                  placeholder="Ej: 30.000"
                  value={montoCobroTurnoInput}
                  onChange={(e) => setMontoCobroTurnoInput(formatCurrency(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-black text-cyan-400 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs font-bold">
              <div className="flex justify-between text-slate-300"><span>Transferencias:</span><span className="font-mono text-cyan-400">${formatCurrency(resumenCierre.tTransferencias)}</span></div>
              <div className="flex justify-between text-slate-300"><span>Tarjeta:</span><span className="font-mono text-cyan-400">${formatCurrency(resumenCierre.tTarjeta)}</span></div>
              <div className="flex justify-between text-slate-300"><span>Fiado:</span><span className="font-mono text-amber-400">${formatCurrency(resumenCierre.tFiado)}</span></div>
              <div className="flex justify-between text-emerald-300 pt-1 border-t border-slate-900"><span>Efectivo Ventas:</span><span className="font-mono">${formatCurrency(resumenCierre.tEfectivo)}</span></div>
              <div className="flex justify-between text-emerald-300"><span>Base Inicio de Día:</span><span className="font-mono">${formatCurrency(resumenCierre.baseInicial)}</span></div>
              <div className="flex justify-between text-rose-400"><span>Compra Insumos:</span><span className="font-mono">-${formatCurrency(resumenCierre.tGastos)}</span></div>
              {parseCurrencyToNumber(montoCobroTurnoInput) > 0 && (
                <div className="flex justify-between text-cyan-300"><span>Descuento Turno:</span><span className="font-mono">-${formatCurrency(montoCobroTurnoInput)}</span></div>
              )}
              <div className="flex justify-between text-sm font-black text-white pt-2 border-t border-slate-800">
                <span>Caja Esperada:</span>
                <span className="font-mono text-emerald-400">${formatCurrency(Math.max(0, resumenCierre.totalCajaEsperado - parseCurrencyToNumber(montoCobroTurnoInput)))}</span>
              </div>
            </div>

            <button onClick={() => setShowCobroTurnoModal(false)} className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase rounded-xl transition-all cursor-pointer shadow-lg">
              Guardar y Cerrar Resumen
            </button>
          </div>
        </div>
      )}

      {/* MODAL CIERRE DE DÍA */}
      {showCierreModal && resumenCierre && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-black text-base text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-400" /> Cierre de Día
              </h3>
              <button onClick={() => setShowCierreModal(false)} className="p-1 text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs font-bold">
              <div className="flex justify-between text-slate-400"><span>Transferencias:</span><span className="font-mono text-slate-200">${formatCurrency(resumenCierre.tTransferencias)}</span></div>
              <div className="flex justify-between text-slate-400"><span>Tarjeta:</span><span className="font-mono text-slate-200">${formatCurrency(resumenCierre.tTarjeta)}</span></div>
              <div className="flex justify-between text-slate-400"><span>Fiado:</span><span className="font-mono text-amber-400">${formatCurrency(resumenCierre.tFiado)}</span></div>
              <div className="flex justify-between text-emerald-400 font-black pt-1 border-t border-slate-900"><span>Efectivo Ventas:</span><span className="font-mono">${formatCurrency(resumenCierre.tEfectivo)}</span></div>
              <div className="flex justify-between text-emerald-400 font-black"><span>Inicio de Día (Base):</span><span className="font-mono">${formatCurrency(resumenCierre.baseInicial)}</span></div>
              <div className="flex justify-between text-rose-400 font-black"><span>Compra de Insumos:</span><span className="font-mono">-${formatCurrency(resumenCierre.tGastos)}</span></div>
              {parseCurrencyToNumber(montoCobroTurnoInput) > 0 && (
                <div className="flex justify-between text-cyan-400 font-black"><span>Cobro de Turno ({nombreEmpleadoTurno}):</span><span className="font-mono">-${formatCurrency(montoCobroTurnoInput)}</span></div>
              )}
              <div className="flex justify-between text-sm font-black text-white pt-2 border-t border-slate-800">
                <span>TOTAL A TENER EN CAJA:</span>
                <span className="font-mono text-emerald-400 text-base">${formatCurrency(resumenCierre.totalCajaEsperado)}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-amber-300 block mb-1">¿Con cuánto dinero cierras caja?</label>
              <input
                type="text"
                placeholder="Digita el valor en efectivo real"
                value={efectivoCierreInput}
                onChange={(e) => setEfectivoCierreInput(formatCurrency(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-amber-500/50 rounded-xl text-sm font-black text-white font-mono focus:outline-none"
              />
            </div>

            <button
              onClick={handleValidarCierreEfectivo}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs uppercase rounded-xl transition-all cursor-pointer shadow-lg"
            >
              Procesar Cierre de Día
            </button>
          </div>
        </div>
      )}

      {/* MODAL RAZÓN DE DIFERENCIA */}
      {showRazonModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/50 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative space-y-4">
            <h3 className="font-black text-sm text-rose-400 flex items-center gap-2 uppercase">
              <AlertTriangle className="w-5 h-5 text-rose-500" /> Valor Inexacto
            </h3>
            <p className="text-xs font-bold text-slate-300">
              ¿Razón por la cual no es igual el dinero ingresado con la base y ventas en efectivo?
            </p>
            <textarea
              rows={3}
              placeholder="Explica el motivo (ej: cambio mal entregado, pago no registrado...)"
              value={razonDiferencia}
              onChange={(e) => setRazonDiferencia(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-rose-500"
            />
            <button
              onClick={() => {
                const dec = parseCurrencyToNumber(efectivoCierreInput);
                const esp = resumenCierre?.totalCajaEsperado || 0;
                finalizarCierreDia(dec, dec - esp, razonDiferencia);
              }}
              className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase rounded-xl cursor-pointer"
            >
              Aceptar y Finalizar Cierre
            </button>
          </div>
        </div>
      )}

      {/* MODAL COBRO EN CAJA */}
      {showCheckout && selectedMesa && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {!saleCompleted ? (
              <>
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
                  <h3 className="font-black text-lg text-white flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-pink-400" /> Cobrar - {selectedMesa.nombre}
                  </h3>
                  <button onClick={() => setShowCheckout(false)} className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-4 space-y-3 max-h-48 overflow-y-auto pr-1">
                  {cartIniciales.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                        🛒 Productos Pedidos:
                      </h4>
                      <div className="space-y-1">
                        {cartIniciales.map((item) => (
                          <div key={item.producto.id} className="flex justify-between items-center text-xs font-bold text-slate-200 border-b border-slate-900/60 pb-1">
                            <span>{item.cantidad}x {item.producto.nombre}</span>
                            <span className="font-mono text-slate-400">${formatCurrency(item.producto.precio * item.cantidad)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {cartAdiciones.length > 0 && (
                    <div className="pt-2 border-t border-slate-900">
                      <h4 className="text-[10px] font-black text-rose-400 uppercase mb-1.5 flex items-center gap-1">
                        ➕ Productos Añadidos Después:
                      </h4>
                      <div className="space-y-1">
                        {cartAdiciones.map((item) => (
                          <div key={item.producto.id} className="flex justify-between items-center text-xs font-bold text-rose-200 border-b border-slate-900/60 pb-1">
                            <span>{item.cantidad}x {item.producto.nombre}</span>
                            <span className="font-mono text-rose-300">${formatCurrency(item.producto.precio * item.cantidad)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 mb-4 flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <DollarSign className="w-4 h-4 text-emerald-400" /> Descuento:
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(discountType === "monto" ? formatCurrency(e.target.value) : e.target.value)}
                      className="w-20 px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-bold text-right text-white"
                    />
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as any)}
                      className="bg-slate-900 border border-slate-800 text-xs font-bold text-white rounded-lg px-2 py-1"
                    >
                      <option value="monto">$</option>
                      <option value="porcentaje">%</option>
                    </select>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-4 space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-400">
                    <span>Subtotal:</span>
                    <span className="font-mono">${formatCurrency(subtotalAmount)}</span>
                  </div>
                  {discountVal > 0 && (
                    <div className="flex justify-between text-xs font-bold text-rose-400">
                      <span>Descuento aplicado:</span>
                      <span className="font-mono">-${formatCurrency(discountVal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xl font-black text-emerald-400 pt-2 border-t border-slate-800">
                    <span>TOTAL FINAL:</span>
                    <span className="font-mono">${formatCurrency(finalTotal)}</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-2xl border border-pink-500/30 mb-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-black text-pink-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Wallet className="w-4 h-4 text-pink-400" /> Registrar Forma de Pago
                    </h4>

                    <button
                      onClick={handlePagoExacto}
                      className="px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/50 hover:bg-emerald-500 hover:text-slate-950 text-emerald-300 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                    >
                      <Zap className="w-3 h-3 text-emerald-400 group-hover:text-slate-950" /> Pago Exacto
                    </button>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5">
                    {(["efectivo", "nequi", "daviplata", "tarjeta", "fiado"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setCurrentMetodo(m)}
                        className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all border cursor-pointer ${
                          currentMetodo === m
                            ? "bg-pink-500 text-white border-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.4)]"
                            : "bg-slate-900 text-slate-400 border-slate-800"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 block mb-1">Monto a Asignar:</label>
                      <input
                        type="text"
                        placeholder={`Ej: ${formatCurrency(saldoPendiente)}`}
                        value={montoIngresado}
                        onChange={(e) => setMontoIngresado(formatCurrency(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-pink-500 font-mono"
                      />
                    </div>

                    {currentMetodo === "efectivo" && (
                      <div>
                        <label className="text-[10px] font-black text-amber-400 block mb-1">Billete Entregado:</label>
                        <input
                          type="text"
                          placeholder="Ej: 20.000, 50.000"
                          value={efectivoRecibido}
                          onChange={(e) => setEfectivoRecibido(formatCurrency(e.target.value))}
                          className="w-full px-3 py-2 bg-slate-900 border border-amber-500/40 rounded-xl text-xs font-bold text-amber-300 focus:outline-none font-mono"
                        />
                        
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          {[10000, 20000, 50000, 100000].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setEfectivoRecibido(formatCurrency(val))}
                              className="px-1.5 py-0.5 bg-amber-500/10 hover:bg-amber-500 hover:text-slate-950 text-amber-400 border border-amber-500/30 rounded text-[9px] font-mono font-bold transition-all cursor-pointer"
                            >
                              ${formatCurrency(val / 1000)}k
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setEfectivoRecibido(montoIngresado || formatCurrency(saldoPendiente))}
                            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px] font-bold transition-all cursor-pointer"
                          >
                            Exacto
                          </button>
                        </div>
                      </div>
                    )}

                    {currentMetodo === "fiado" && (
                      <div className="col-span-2">
                        <label className="text-[10px] font-black text-amber-400 block mb-1">Nombre del Cliente (Fiado):</label>
                        <input
                          type="text"
                          placeholder="Ej: Carlos Ruiz, Doña María..."
                          value={clienteFiado}
                          onChange={(e) => setClienteFiado(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-amber-500/40 rounded-xl text-xs font-bold text-white focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {currentMetodo === "efectivo" && parseCurrencyToNumber(efectivoRecibido) > 0 && parseCurrencyToNumber(montoIngresado) > 0 && (
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex justify-between items-center text-xs font-black text-amber-300">
                      <span>Devuelta / Cambio:</span>
                      <span className="font-mono text-sm">
                        ${formatCurrency(Math.max(0, parseCurrencyToNumber(efectivoRecibido) - parseCurrencyToNumber(montoIngresado)))}
                      </span>
                    </div>
                  )}

                  <button
                    onClick={handleAgregarPago}
                    className="w-full py-2.5 bg-pink-600 hover:bg-pink-500 text-white font-black text-xs uppercase rounded-xl border border-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.4)] transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Agregar Pago
                  </button>
                </div>

                {pagos.length > 0 && (
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-4 space-y-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase">Pagos Registrados:</h4>
                    {pagos.map((p, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs font-bold bg-slate-900 p-2 rounded-xl border border-slate-800">
                        <div>
                          <span className="uppercase text-pink-400">{p.metodo}</span>: ${formatCurrency(p.monto)}
                          {p.cambioEfectivo !== undefined && (
                            <span className="text-[10px] text-amber-300 block">
                              Recibido: ${formatCurrency(p.montoEntregadoEfectivo)} | Cambio: ${formatCurrency(p.cambioEfectivo)}
                            </span>
                          )}
                          {p.clienteFiado && (
                            <span className="text-[10px] text-amber-400 block">Fiado a: {p.clienteFiado}</span>
                          )}
                        </div>
                        <button onClick={() => handleEliminarPago(idx)} className="text-rose-400 hover:text-white p-1 cursor-pointer">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mb-4">
                  {saldoPendiente > 0 ? (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/40 rounded-2xl flex items-center justify-between text-xs font-black text-rose-400">
                      <span className="flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> SALDO PENDIENTE / DEUDA:
                      </span>
                      <span className="font-mono text-sm">${formatCurrency(saldoPendiente)}</span>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/40 rounded-2xl flex items-center justify-between text-xs font-black text-emerald-400">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> COMPRA TOTALMENTE CUBIERTA
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleFinalizeSale}
                  disabled={saldoPendiente > 0}
                  className={`w-full py-3.5 font-black uppercase text-xs rounded-2xl shadow-lg cursor-pointer transition-all ${
                    saldoPendiente > 0
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                  }`}
                >
                  {saldoPendiente > 0 ? "⚠️ Pago Incompleto (No se puede liberar mesa)" : "✅ Finalizar Venta y Liberar Mesa"}
                </button>
              </>
            ) : (
              <div className="text-center py-6 space-y-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                <h3 className="font-black text-xl text-white">¡Venta Registrada Exitosamente!</h3>
                <p className="text-xs text-slate-400">La mesa ha sido liberada y restablecida correctamente.</p>
                <button onClick={() => { setShowCheckout(false); setSelectedMesa(null); }} className="w-full py-3 bg-pink-500 text-white font-black uppercase text-xs rounded-2xl cursor-pointer">
                  Volver al Mapa
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}