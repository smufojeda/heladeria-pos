"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  IceCream,
  Users,
  Clock,
  PlusCircle,
  ShoppingBag,
  CreditCard,
  Receipt,
  Search,
  Sparkles,
  ArrowLeft,
  X,
  Plus,
  Minus,
  ChevronUp,
  CheckCircle2,
} from "lucide-react";

interface Mesa {
  id: number;
  numero: number;
  nombre: string;
  estado: "disponible" | "ocupada" | "cuenta";
  capacidad: number;
}

interface Producto {
  id: number;
  nombre: string;
  categoria: string;
  precio: number;
  descripcion: string;
  disponible: boolean;
}

interface CartItem {
  producto: Producto;
  cantidad: number;
  notas?: string;
}

export default function HomePOS() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);

  // Categoría seleccionada para filtro
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [searchQuery, setSearchQuery] = useState("");

  // Carrito de compras / Comanda actual
  const [cart, setCart] = useState<CartItem[]>([]);

  // Estado del Drawer/Modal de Comanda en Móvil
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // Modal Cierre de Cuenta
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "nequi" | "tarjeta">("efectivo");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [saleCompleted, setSaleCompleted] = useState<boolean>(false);

  // 1. Cargar Mesas y Productos desde Supabase
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: mesasData } = await supabase
        .from("mesas")
        .select("*")
        .order("numero", { ascending: true });

      const { data: prodData } = await supabase
        .from("productos")
        .select("*")
        .order("id", { ascending: true });

      if (mesasData && mesasData.length > 0) setMesas(mesasData);
      else {
        setMesas([
          { id: 1, numero: 1, nombre: "Mesa 1", estado: "disponible", capacidad: 4 },
          { id: 2, numero: 2, nombre: "Mesa 2", estado: "ocupada", capacidad: 4 },
          { id: 3, numero: 3, nombre: "Mesa 3", estado: "cuenta", capacidad: 2 },
          { id: 4, numero: 4, nombre: "Mesa 4", estado: "disponible", capacidad: 6 },
          { id: 5, numero: 5, nombre: "Mesa 5", estado: "disponible", capacidad: 4 },
          { id: 6, numero: 6, nombre: "Mesa 6", estado: "disponible", capacidad: 2 },
          { id: 7, numero: 7, nombre: "Mesa 7", estado: "disponible", capacidad: 4 },
          { id: 8, numero: 8, nombre: "Mesa 8", estado: "disponible", capacidad: 8 },
        ]);
      }

      if (prodData && prodData.length > 0) setProductos(prodData);
      else {
        setProductos([
          { id: 1, nombre: "Helado 1 Bola", categoria: "Helados", precio: 4500, descripcion: "Sabor a elección", disponible: true },
          { id: 2, nombre: "Helado 2 Bolas", categoria: "Helados", precio: 8000, descripcion: "Dos sabores a elección", disponible: true },
          { id: 3, nombre: "Copa Especial Heladería", categoria: "Especiales", precio: 15000, descripcion: "3 Bolas, crema y salsa", disponible: true },
          { id: 4, nombre: "Banana Split", categoria: "Especiales", precio: 18000, descripcion: "Banano, 3 bolas, cereza y crema", disponible: true },
          { id: 5, nombre: "Topping Chispas / Gomitas", categoria: "Toppings", precio: 1500, descripcion: "Porción adicional", disponible: true },
          { id: 6, nombre: "Salsa de Chocolate / Arequipe", categoria: "Toppings", precio: 2000, descripcion: "Porción adicional", disponible: true },
          { id: 7, nombre: "Agua Mineral", categoria: "Bebidas", precio: 3000, descripcion: "Botella 500ml", disponible: true },
          { id: 8, nombre: "Malteada", categoria: "Bebidas", precio: 12000, descripcion: "Sabor a elección con leche", disponible: true },
        ]);
      }
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Cargar pedido de la mesa si está ocupada o en cuenta
  const handleSelectMesa = async (mesa: Mesa) => {
    setSelectedMesa(mesa);
    setCart([]);
    setShowCheckout(false);
    setSaleCompleted(false);
    setIsMobileCartOpen(false);

    // Buscar pedido activo en Supabase
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
        }));
        setCart(loadedCart);
      }
    }
  };

  // Agregar Producto a la Comanda
  const addToCart = (producto: Producto) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.producto.id === producto.id);
      if (existing) {
        return prev.map((item) =>
          item.producto.id === producto.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }
      return [...prev, { producto, cantidad: 1 }];
    });
  };

  const updateQuantity = (productoId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.producto.id === productoId) {
            const newQty = item.cantidad + delta;
            return newQty > 0 ? { ...item, cantidad: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Totales
  const totalAmount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.producto.precio * item.cantidad, 0);
  }, [cart]);

  const totalItemsCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.cantidad, 0);
  }, [cart]);

  // Guardar Pedido en Supabase y Actualizar Estado
  const handleSaveOrder = async () => {
    if (!selectedMesa) return;

    await supabase.from("mesas").update({ estado: "ocupada" }).eq("id", selectedMesa.id);

    let { data: pedido } = await supabase
      .from("pedidos")
      .select("id")
      .eq("mesa_id", selectedMesa.id)
      .eq("estado", "abierto")
      .single();

    if (!pedido) {
      const { data: newPedido } = await supabase
        .from("pedidos")
        .insert({ mesa_id: selectedMesa.id, total: totalAmount, estado: "abierto" })
        .select()
        .single();
      pedido = newPedido;
    } else {
      await supabase.from("pedidos").update({ total: totalAmount }).eq("id", pedido.id);
      await supabase.from("pedido_items").delete().eq("pedido_id", pedido.id);
    }

    if (pedido && cart.length > 0) {
      const itemsToInsert = cart.map((item) => ({
        pedido_id: pedido.id,
        producto_id: item.producto.id,
        cantidad: item.cantidad,
        precio_unitario: item.producto.precio,
      }));
      await supabase.from("pedido_items").insert(itemsToInsert);
    }

    fetchData();
    setSelectedMesa(null);
    setIsMobileCartOpen(false);
  };

  // Procesar Cierre de Cuenta & Facturación
  const handleFinalizeSale = async () => {
    if (!selectedMesa) return;

    await supabase.from("ventas").insert({
      mesa_id: selectedMesa.id,
      numero_mesa: selectedMesa.numero,
      metodo_pago: paymentMethod,
      total: totalAmount,
    });

    await supabase
      .from("pedidos")
      .update({ estado: "pagado" })
      .eq("mesa_id", selectedMesa.id)
      .eq("estado", "abierto");

    await supabase.from("mesas").update({ estado: "disponible" }).eq("id", selectedMesa.id);

    setSaleCompleted(true);
    fetchData();
  };

  const categories = ["Todos", "Helados", "Especiales", "Toppings", "Bebidas"];

  const filteredProducts = productos.filter((p) => {
    const matchesCat = selectedCategory === "Todos" || p.categoria === selectedCategory;
    const matchesSearch = p.nombre.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased flex flex-col selection:bg-pink-500 selection:text-white">
      {/* HEADER RESPONSIVO */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-pink-500/20 px-3 sm:px-8 py-3 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white shadow-[0_0_15px_rgba(236,72,153,0.5)]">
            <IceCream className="w-5 h-5 sm:w-6 sm:h-6 animate-bounce" />
          </div>
          <div>
            <h1 className="text-base sm:text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-300 uppercase">
              Heladería POS
            </h1>
            <p className="text-[9px] sm:text-xs font-bold text-slate-400 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-pink-400" /> Control de Mesas
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          className="px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded-xl text-[11px] sm:text-xs font-black text-cyan-300 transition-all cursor-pointer active:scale-95 shadow flex items-center gap-1.5"
        >
          🔄 <span className="hidden sm:inline">Sincronizar</span>
        </button>
      </header>

      {/* VISTA PRINCIPAL: SALÓN O COMANDA */}
      {!selectedMesa ? (
        <main className="flex-1 p-3 sm:p-8 max-w-7xl mx-auto w-full">
          {/* LEYENDA RESPONSIVA DE ESTADOS */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6 bg-slate-900/60 p-3 sm:p-4 rounded-2xl border border-slate-800/80 backdrop-blur shadow-lg">
            <div className="flex items-center justify-around w-full sm:w-auto gap-4 text-[11px] sm:text-xs font-black">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                <span className="text-slate-300">Disponible</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-pulse" />
                <span className="text-slate-300">Ocupada</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                <span className="text-slate-300">Por Pagar</span>
              </div>
            </div>

            <div className="text-[11px] sm:text-xs font-extrabold text-slate-400">
              Total Mesas: <span className="text-pink-400 font-black">{mesas.length}</span>
            </div>
          </div>

          {/* GRID DE MESAS ADAPTATIVO */}
          {loading ? (
            <div className="text-center py-20 text-slate-400 font-bold animate-pulse text-xs sm:text-sm">
              Cargando mapa de salón...
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-5">
              {mesas.map((mesa) => {
                const isDisp = mesa.estado === "disponible";
                const isOcup = mesa.estado === "ocupada";

                return (
                  <div
                    key={mesa.id}
                    onClick={() => handleSelectMesa(mesa)}
                    className={`group relative rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border-2 transition-all cursor-pointer overflow-hidden flex flex-col justify-between h-36 sm:h-44 shadow-lg active:scale-95 ${
                      isDisp
                        ? "bg-slate-900/80 border-emerald-500/30 hover:border-emerald-400/80 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                        : isOcup
                        ? "bg-rose-950/20 border-rose-500/60 hover:border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.15)]"
                        : "bg-amber-950/20 border-amber-400/60 hover:border-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.15)]"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-1">
                      <div>
                        <h3 className="font-black text-base sm:text-xl text-white tracking-wide group-hover:text-pink-300 transition-colors">
                          {mesa.nombre}
                        </h3>
                        <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                          <Users className="w-3 h-3" /> Cap: {mesa.capacidad}
                        </p>
                      </div>
                      <span
                        className={`text-[8px] sm:text-[9px] font-black px-2 py-0.5 sm:px-3 sm:py-1 rounded-full uppercase tracking-wider ${
                          isDisp
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                            : isOcup
                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                            : "bg-amber-400/20 text-amber-300 border border-amber-400/40"
                        }`}
                      >
                        {mesa.estado}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] sm:text-xs font-black">
                      {isDisp ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <PlusCircle className="w-3.5 h-3.5" /> Abrir
                        </span>
                      ) : (
                        <span className="text-amber-300 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Ver
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      ) : (
        /* VISTA INTERACTIVA DE COMANDA CON BARRA FLOTANTE MÓVIL */
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          {/* MENU Y PRODUCTOS */}
          <div className="flex-1 p-3 sm:p-6 overflow-y-auto space-y-4 pb-28 lg:pb-6">
            {/* VOLVER Y BÚSQUEDA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <button
                onClick={() => setSelectedMesa(null)}
                className="self-start px-3 py-1.5 sm:px-3.5 sm:py-2 bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl text-xs font-black text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <ArrowLeft className="w-4 h-4 text-pink-400" /> Salón de Mesas
              </button>

              <div className="relative flex-1 w-full sm:max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar helado o bebida..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 transition-colors"
                />
              </div>
            </div>

            {/* FILTRO CATEGORÍAS */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                    selectedCategory === cat
                      ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-[0_0_12px_rgba(236,72,153,0.4)]"
                      : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* GRID PRODUCTOS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              {filteredProducts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="bg-slate-900/90 border border-slate-800/90 hover:border-pink-500/50 p-3.5 rounded-2xl sm:rounded-3xl cursor-pointer transition-all flex flex-col justify-between group active:scale-95 shadow-md"
                >
                  <div>
                    <span className="text-[8px] sm:text-[9px] font-black uppercase text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full">
                      {p.categoria}
                    </span>
                    <h4 className="font-black text-xs sm:text-sm text-white mt-1.5 group-hover:text-pink-300 transition-colors">
                      {p.nombre}
                    </h4>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 line-clamp-2">
                      {p.descripcion}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-800 flex justify-between items-center">
                    <span className="font-black text-xs sm:text-sm text-emerald-400 font-mono">
                      ${p.precio.toLocaleString()}
                    </span>
                    <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-pink-500/20 text-pink-400 group-hover:bg-pink-500 group-hover:text-white flex items-center justify-center font-black text-base transition-all">
                      +
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* BARRA FLOTANTE DE COMANDA MÓVIL (VISIBLE SOLO EN PANTALLAS PEQUEÑAS) */}
          <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900 border-t border-pink-500/40 p-3 shadow-[0_-5px_25px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => setIsMobileCartOpen(!isMobileCartOpen)}
                className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 flex-1 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 text-pink-400" />
                <div className="text-left">
                  <span className="text-[9px] font-bold text-slate-400 block uppercase">
                    Comanda ({totalItemsCount})
                  </span>
                  <span className="text-xs font-black text-emerald-400 font-mono">
                    ${totalAmount.toLocaleString()}
                  </span>
                </div>
                <ChevronUp className={`w-4 h-4 text-slate-400 ml-auto transition-transform ${isMobileCartOpen ? "rotate-180" : ""}`} />
              </button>

              <button
                onClick={handleSaveOrder}
                disabled={cart.length === 0}
                className="px-3 py-2 bg-slate-800 disabled:opacity-40 text-slate-200 font-black text-xs rounded-xl border border-slate-700 cursor-pointer"
              >
                💾 Guardar
              </button>

              <button
                onClick={() => setShowCheckout(true)}
                disabled={cart.length === 0}
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 disabled:opacity-40 text-slate-950 font-black text-xs rounded-xl cursor-pointer shadow flex items-center gap-1"
              >
                <CreditCard className="w-3.5 h-3.5" /> Cobrar
              </button>
            </div>
          </div>

          {/* PANEL DERECHO / DRAWER EN MÓVIL */}
          <div
            className={`w-full lg:w-96 bg-slate-900/95 border-t lg:border-t-0 lg:border-l border-slate-800 p-4 sm:p-5 flex flex-col justify-between shadow-2xl transition-all duration-300 fixed lg:relative bottom-0 inset-x-0 z-50 lg:z-auto ${
              isMobileCartOpen ? "h-[75vh] lg:h-auto" : "hidden lg:flex"
            }`}
          >
            <div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <div>
                  <h2 className="font-black text-base sm:text-lg text-white flex items-center gap-2">
                    <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-pink-400" /> {selectedMesa.nombre}
                  </h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">
                    Comanda Activa
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-pink-400 bg-pink-500/10 px-2.5 py-0.5 rounded-full">
                    {totalItemsCount} Ítems
                  </span>
                  <button
                    onClick={() => setIsMobileCartOpen(false)}
                    className="lg:hidden p-1 text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* LISTA DE ITEMS */}
              <div className="my-3 space-y-2.5 max-h-[40vh] sm:max-h-[45vh] overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 font-bold text-xs flex flex-col items-center gap-1.5">
                    <ShoppingBag className="w-7 h-7 opacity-40 text-slate-400" />
                    Agrega helados a la comanda.
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.producto.id}
                      className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex-1 pr-2">
                        <h5 className="font-black text-xs text-slate-200">
                          {item.producto.nombre}
                        </h5>
                        <p className="text-[10px] text-slate-400 font-mono">
                          ${item.producto.precio.toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateQuantity(item.producto.id, -1)}
                          className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 font-black flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-black text-xs text-white w-4 text-center">
                          {item.cantidad}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.producto.id, 1)}
                          className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 font-black flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* TOTALES */}
            <div className="pt-3 border-t border-slate-800 space-y-2.5">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                <span>Subtotal</span>
                <span className="font-mono text-slate-200">${totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-base sm:text-lg font-black text-white">
                <span>TOTAL A PAGAR</span>
                <span className="font-mono text-emerald-400 text-lg sm:text-xl">
                  ${totalAmount.toLocaleString()}
                </span>
              </div>

              <div className="hidden lg:grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={handleSaveOrder}
                  disabled={cart.length === 0}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-black text-xs rounded-xl cursor-pointer border border-slate-700"
                >
                  💾 Guardar Comanda
                </button>
                <button
                  onClick={() => setShowCheckout(true)}
                  disabled={cart.length === 0}
                  className="py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 disabled:opacity-40 text-slate-950 font-black text-xs rounded-xl cursor-pointer shadow active:scale-95 flex items-center justify-center gap-1"
                >
                  <CreditCard className="w-4 h-4" /> Cobrar Cuenta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RESPONSIVO DE CIERRE DE CUENTA Y FACTURACIÓN */}
      {showCheckout && selectedMesa && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-w-md w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {!saleCompleted ? (
              <>
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800">
                  <h3 className="font-black text-base sm:text-lg text-white flex items-center gap-1.5">
                    💳 Cobrar - {selectedMesa.nombre}
                  </h3>
                  <button
                    onClick={() => setShowCheckout(false)}
                    className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 mb-3 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Total a Cobrar</span>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                    ${totalAmount.toLocaleString()}
                  </span>
                </div>

                {/* MÉTODO DE PAGO */}
                <div className="space-y-2 mb-4">
                  <label className="text-[11px] font-black text-slate-300 uppercase block">
                    Método de Pago
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["efectivo", "nequi", "tarjeta"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setPaymentMethod(m)}
                        className={`py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer border ${
                          paymentMethod === m
                            ? "bg-pink-500 text-white border-pink-400 shadow-[0_0_12px_rgba(236,72,153,0.4)]"
                            : "bg-slate-950 text-slate-400 border-slate-800"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CAMBIO SI ES EFECTIVO */}
                {paymentMethod === "efectivo" && (
                  <div className="mb-4 space-y-1.5">
                    <label className="text-[11px] font-black text-slate-300 uppercase block">
                      Monto Recibido
                    </label>
                    <input
                      type="number"
                      placeholder="Ej: 20000"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-black text-white font-mono focus:outline-none focus:border-pink-500"
                    />
                    {Number(cashReceived) >= totalAmount && (
                      <div className="p-2 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-xs font-black text-emerald-400 flex justify-between">
                        <span>Cambio:</span>
                        <span className="font-mono">
                          ${(Number(cashReceived) - totalAmount).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={handleFinalizeSale}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black uppercase text-xs rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.5)] cursor-pointer active:scale-95 transition-all"
                >
                  ✅ Confirmar y Cerrar Venta
                </button>
              </>
            ) : (
              /* TICKETA DIGITAL DE ÉXITO */
              <div className="text-center py-4 space-y-3">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-500/20 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)]">
                  <CheckCircle2 className="w-8 h-8 sm:w-9 sm:h-9 animate-bounce" />
                </div>
                <h3 className="font-black text-lg sm:text-xl text-white">¡Venta Finalizada!</h3>
                <p className="text-xs text-slate-400 font-semibold">
                  La mesa {selectedMesa.nombre} ha sido liberada.
                </p>

                <button
                  onClick={() => {
                    setShowCheckout(false);
                    setSelectedMesa(null);
                    setIsMobileCartOpen(false);
                  }}
                  className="w-full py-2.5 bg-pink-500 text-white font-black uppercase text-xs rounded-xl shadow cursor-pointer active:scale-95 transition-all"
                >
                  Volver al Salón
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}