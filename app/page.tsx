"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
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
  Tag,
  CheckCircle2,
  AlertCircle,
  Send,
  Trash2,
  BookOpenCheck,
  User,
} from "lucide-react";

type EstadoMesa = "libre" | "pendiente_servir" | "preparado" | "servido" | "pendiente_pago";
type ModoVista = "caja" | "mesero" | "cocina";

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

export default function HomePOS() {
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

  // Modal Caja
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "nequi" | "daviplata" | "tarjeta" | "fiado">("efectivo");
  const [clienteFiado, setClienteFiado] = useState<string>("");
  const [discountInput, setDiscountInput] = useState<string>("0");
  const [discountType, setDiscountType] = useState<"monto" | "porcentaje">("monto");
  const [saleCompleted, setSaleCompleted] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: mesasData } = await supabase.from("mesas").select("*").order("numero", { ascending: true });
      const { data: prodData } = await supabase.from("productos").select("*").order("id", { ascending: true });

      if (mesasData && mesasData.length > 0) {
        const formattedMesas = mesasData.map((m, idx) => {
          let customName = m.nombre;
          if (idx < 5) customName = `Mesa ${idx + 1}`;
          else if (idx === 5) customName = "Barra 1";
          else if (idx === 6) customName = "Barra 2";

          return { ...m, nombre: customName };
        });
        setMesas(formattedMesas as Mesa[]);
      }
      if (prodData && prodData.length > 0) setProductos(prodData);

      fetchPedidosCocina();
    } catch (_) {}
    setLoading(false);
  };

  // FIX: Cocina únicamente consulta lo que esté explícitamente PENDIENTE DE SERVIR
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
  }, []);

  const handleSelectMesa = async (mesa: Mesa) => {
    setSelectedMesa(mesa);
    setCart([]);
    setInitialItemsCount(0);
    setShowCheckout(false);
    setSaleCompleted(false);
    setClienteFiado("");

    const { data: pedido } = await supabase
      .from("pedidos")
      .select("id")
      .eq("mesa_id", mesa.id)
      .eq("estado", "abierto")
      .single();

    if (pedido) {
      const { data: items } = await supabase
        .from("pedido_items")
        .select("*, productos(*)")
        .eq("pedido_id", pedido.id);

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
    setCart((prev) => {
      const isAdicion = initialItemsCount > 0;
      const existing = prev.find(
        (item) => item.producto.id === producto.id && item.es_adicion === isAdicion
      );

      if (existing) {
        return prev.map((item) =>
          item.producto.id === producto.id && item.es_adicion === isAdicion
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }
      return [...prev, { producto, cantidad: 1, es_adicion: isAdicion }];
    });
  };

  const updateQuantity = (productoId: number, delta: number, esAdicion: boolean = false) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.producto.id === productoId && item.es_adicion === esAdicion) {
            const newQty = item.cantidad + delta;
            return newQty > 0 ? { ...item, cantidad: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const subtotalAmount = useMemo(() => cart.reduce((acc, item) => acc + item.producto.precio * item.cantidad, 0), [cart]);

  const discountVal = useMemo(() => {
    const val = Number(discountInput) || 0;
    return discountType === "porcentaje" ? (subtotalAmount * val) / 100 : val;
  }, [discountInput, discountType, subtotalAmount]);

  const finalTotal = useMemo(() => Math.max(0, subtotalAmount - discountVal), [subtotalAmount, discountVal]);

  const handleSaveOrder = async () => {
    if (!selectedMesa) return;

    await supabase.from("mesas").update({ estado: "pendiente_servir" }).eq("id", selectedMesa.id);

    let { data: pedido } = await supabase
      .from("pedidos")
      .select("id")
      .eq("mesa_id", selectedMesa.id)
      .eq("estado", "abierto")
      .single();

    if (!pedido) {
      const { data: newPedido } = await supabase
        .from("pedidos")
        .insert({ mesa_id: selectedMesa.id, total: subtotalAmount, estado: "abierto", estado_pedido: "pendiente_servir" })
        .select()
        .single();
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

      const adicionesItems = cart.filter((i) => i.es_adicion || initialItemsCount === 0);
      for (const item of adicionesItems) {
        const { error: rpcError } = await supabase.rpc("descontar_stock", {
          p_id: item.producto.id,
          p_cantidad: item.cantidad,
        });

        if (rpcError) {
          const { data: prodData } = await supabase.from("productos").select("stock").eq("id", item.producto.id).single();
          if (prodData) {
            const newStock = Math.max(0, (prodData.stock ?? 50) - item.cantidad);
            await supabase.from("productos").update({ stock: newStock, disponible: newStock > 0 }).eq("id", item.producto.id);
          }
        }
      }
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

    if (paymentMethod === "fiado" && !clienteFiado.trim()) {
      alert("Por favor ingresa el nombre de la persona a la que le vas a fiar.");
      return;
    }

    const itemsSummary = cart.map((i) => ({
      nombre: i.producto.nombre,
      cantidad: i.cantidad,
      precio: i.producto.precio,
    }));

    await supabase.from("ventas").insert({
      mesa_id: selectedMesa.id,
      numero_mesa: selectedMesa.numero,
      metodo_pago: paymentMethod,
      cliente_nombre: paymentMethod === "fiado" ? clienteFiado.trim() : null,
      subtotal: subtotalAmount,
      descuento: discountVal,
      total: finalTotal,
      items_detalle: itemsSummary,
    });

    await supabase.from("pedidos").update({ estado: "pagado", estado_pedido: "servido" }).eq("mesa_id", selectedMesa.id).eq("estado", "abierto");
    await supabase.from("mesas").update({ estado: "libre" }).eq("id", selectedMesa.id);

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased flex flex-col selection:bg-pink-500 selection:text-white">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-pink-500/30 px-4 sm:px-8 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-600 p-1 flex items-center justify-center text-white shadow-[0_0_20px_rgba(236,72,153,0.5)]">
            <img src="/cafe.png" alt="Logo Café" className="w-full h-full object-contain rounded-xl" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-300 uppercase">
              Heladería POS
            </h1>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-pink-400" /> Control Integral de Servicio
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800/90 w-full md:w-auto justify-center flex-wrap">
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

          <Link
            href="/admin"
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all cursor-pointer active:scale-95"
          >
            <ShieldCheck className="w-4 h-4" /> ADMIN
          </Link>
        </div>
      </header>

      {/* VISTA COCINA */}
      {vista === "cocina" && (
        <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full">
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
                                <span className="font-mono text-[11px]">${(it.precio_unitario * it.cantidad).toLocaleString()}</span>
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
                              <span className="font-mono text-xs text-slate-400">${(it.precio_unitario * it.cantidad).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 space-y-3">
                      <div className="flex justify-between items-center text-sm font-black">
                        <span className="text-slate-400">TOTAL COMANDA:</span>
                        <span className="font-mono text-emerald-400 text-base">${p.total?.toLocaleString()}</span>
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
            <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
                {mesas.map((mesa) => {
                  const isLibre = mesa.estado === "libre";
                  const isPendServir = mesa.estado === "pendiente_servir";
                  const isPreparado = mesa.estado === "preparado";
                  const isServido = mesa.estado === "servido";

                  return (
                    <div
                      key={mesa.id}
                      onClick={() => handleSelectMesa(mesa)}
                      className={`group relative rounded-3xl p-5 border-2 transition-all cursor-pointer overflow-hidden flex flex-col justify-between h-64 sm:h-72 shadow-xl ${
                        isLibre
                          ? "bg-slate-900/80 border-emerald-500/30"
                          : isPendServir
                          ? "bg-amber-950/20 border-amber-400/60"
                          : isPreparado
                          ? "bg-purple-950/30 border-purple-500 animate-pulse"
                          : "bg-cyan-950/20 border-cyan-400/60"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <h3 className="font-black text-xl text-white">{mesa.nombre}</h3>
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full uppercase bg-slate-800 text-slate-300">
                          {mesa.estado.replace("_", " ")}
                        </span>
                      </div>

                      <div className="flex-1 flex justify-center items-center my-1">
                        <img src={isLibre ? "/mesa1.png" : "/mesa2.png"} alt={mesa.nombre} className="h-28 w-auto object-contain" />
                      </div>

                      <div className="pt-2 border-t border-slate-800/80">
                        {vista === "caja" ? (
                          <button className="w-full py-1.5 bg-pink-500/20 text-pink-300 border border-pink-500/40 font-black text-xs rounded-xl">
                            {isLibre ? "Disponible" : "💳 Cobrar"}
                          </button>
                        ) : (
                          <div>
                            {isPreparado ? (
                              <button
                                onClick={(e) => handleEntregarAMesa(mesa.id, e)}
                                className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs uppercase rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.5)] flex items-center justify-center gap-1.5"
                              >
                                <Send className="w-3.5 h-3.5" /> Entregar
                              </button>
                            ) : (
                              <div className="text-[10px] font-black text-center text-slate-400 py-1">
                                {isLibre ? "+ Tomar Pedido" : isServido ? "➕ Agregar Adición" : "Ver / Modificar Comanda"}
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
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 pb-32 lg:pb-6">
                <div className="flex items-center justify-between gap-3">
                  <button onClick={() => setSelectedMesa(null)} className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-black text-slate-300 flex items-center gap-2 cursor-pointer">
                    <ArrowLeft className="w-4 h-4 text-pink-400" /> Volver a Mesas/Barras
                  </button>
                  <input
                    type="text"
                    placeholder="Buscar producto..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full max-w-xs px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                  {filteredProducts.map((p) => (
                    <div key={p.id} onClick={() => addToCart(p)} className="bg-slate-900/90 border border-slate-800 p-4 rounded-3xl cursor-pointer hover:border-pink-500/50 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] font-black uppercase text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full">{p.categoria}</span>
                        <h4 className="font-black text-sm text-white mt-1.5">{p.nombre}</h4>
                        <p className="text-[10px] font-mono text-slate-400 mt-1">Stock: {p.stock ?? 50}</p>
                      </div>
                      <div className="mt-4 pt-2 border-t border-slate-800 flex justify-between items-center">
                        <span className="font-black text-sm text-emerald-400 font-mono">${p.precio.toLocaleString()}</span>
                        <span className="w-7 h-7 rounded-lg bg-pink-500/20 text-pink-400 font-black flex items-center justify-center">+</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-full lg:w-96 bg-slate-900/95 border-t lg:border-l border-slate-800 p-5 flex flex-col justify-between shadow-2xl">
                <div>
                  <h2 className="font-black text-lg text-white flex items-center gap-2 pb-3 border-b border-slate-800">
                    <Receipt className="w-5 h-5 text-pink-400" /> {selectedMesa.nombre}
                  </h2>
                  <div className="my-4 space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                    {cart.map((item, idx) => (
                      <div key={`${item.producto.id}-${item.es_adicion ? "adicion" : "normal"}-${idx}`} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                        <div>
                          <h5 className="font-black text-xs text-slate-100 flex items-center gap-1.5">
                            {item.producto.nombre}
                            {item.es_adicion && <span className="text-[8px] bg-rose-500/20 text-rose-400 border border-rose-500/40 px-1.5 py-0.5 rounded-md font-bold">ADICIÓN</span>}
                          </h5>
                          <p className="text-[11px] text-slate-400 font-mono">${item.producto.precio.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQuantity(item.producto.id, -1, item.es_adicion)} className="w-6 h-6 rounded-lg bg-slate-800 text-white font-black"><Minus className="w-3 h-3" /></button>
                          <span className="font-black text-xs text-white">{item.cantidad}</span>
                          <button onClick={() => updateQuantity(item.producto.id, 1, item.es_adicion)} className="w-6 h-6 rounded-lg bg-slate-800 text-white font-black"><Plus className="w-3 h-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex justify-between text-lg font-black text-white">
                    <span>TOTAL</span>
                    <span className="font-mono text-emerald-400">${subtotalAmount.toLocaleString()}</span>
                  </div>
                  <button onClick={handleSaveOrder} disabled={cart.length === 0} className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-2xl shadow flex items-center justify-center gap-2 cursor-pointer active:scale-95">
                    <ChefHat className="w-5 h-5" /> Enviar a Cocina
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL COBRO EN CAJA */}
      {showCheckout && selectedMesa && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {!saleCompleted ? (
              <>
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
                  <h3 className="font-black text-lg text-white flex items-center gap-2">💳 Cobrar - {selectedMesa.nombre}</h3>
                  <button onClick={() => setShowCheckout(false)} className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center">
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
                            <span className="font-mono text-slate-400">${(item.producto.precio * item.cantidad).toLocaleString()}</span>
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
                            <span className="font-mono text-rose-300">${(item.producto.precio * item.cantidad).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-4 space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-400">
                    <span>Subtotal:</span>
                    <span className="font-mono">${subtotalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xl font-black text-emerald-400 pt-2 border-t border-slate-800">
                    <span>TOTAL FINAL:</span>
                    <span className="font-mono">${finalTotal.toLocaleString()}</span>
                  </div>
                </div>

                {/* BOTONES DE MÉTODO DE PAGO */}
                <div className="space-y-3 mb-4">
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {(["efectivo", "nequi", "daviplata", "tarjeta", "fiado"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setPaymentMethod(m)}
                        className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all border flex flex-col items-center justify-center gap-1 cursor-pointer ${
                          paymentMethod === m
                            ? m === "fiado"
                              ? "bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                              : "bg-pink-500 text-white border-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.4)]"
                            : "bg-slate-950 text-slate-400 border-slate-800"
                        }`}
                      >
                        {m === "fiado" && <BookOpenCheck className="w-3.5 h-3.5" />}
                        {m}
                      </button>
                    ))}
                  </div>

                  {paymentMethod === "fiado" && (
                    <div className="bg-amber-950/30 border border-amber-500/50 p-3 rounded-2xl space-y-1.5 animate-fadeIn">
                      <label className="text-[11px] font-black text-amber-300 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-amber-400" /> Nombre del Cliente a Fiar:
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Carlos Ruiz, Juan, Doña María..."
                        value={clienteFiado}
                        onChange={(e) => setClienteFiado(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                        autoFocus
                      />
                    </div>
                  )}
                </div>

                <button
                  onClick={handleFinalizeSale}
                  className={`w-full py-3.5 font-black uppercase text-xs rounded-2xl shadow-lg cursor-pointer active:scale-95 text-slate-950 ${
                    paymentMethod === "fiado"
                      ? "bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300"
                      : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400"
                  }`}
                >
                  {paymentMethod === "fiado" ? "📌 Registrar Cuenta Fiada (Liberar Mesa)" : "✅ Cobrar y Finalizar Venta"}
                </button>
              </>
            ) : (
              <div className="text-center py-6 space-y-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                <h3 className="font-black text-xl text-white">
                  {paymentMethod === "fiado"
                    ? `¡Cuenta Fiada Registrada a ${clienteFiado}! (Mesa Liberada)`
                    : "¡Venta Registrada!"}
                </h3>
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