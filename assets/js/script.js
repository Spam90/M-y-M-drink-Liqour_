// =====================================================
//  M&M DRINK LIQUOR · SCRIPT COMPLETO OPTIMIZADO
//  Compatible con base de datos real (845 productos, 152 ofertas)
// =====================================================

let menuProducts = [];
let currentCategory = 'all';
let currentPage = 1;
let searchQuery = '';
const itemsPerPage = 12;
let cart = [];
let imageCache = {};
let dailyDrink = null;
let isLoading = true;

const DEFAULT_WHATSAPP = '18294481651';
const FALLBACK_IMAGE = 'assets/img/placeholder.png';

// ============ CINEMATIC OVERLAY ============
function hideCinematicOverlay() {
    const overlay = document.getElementById('cinematic-overlay');
    if (overlay) {
        setTimeout(() => {
            overlay.classList.add('hidden');
            setTimeout(() => {
                overlay.style.display = 'none';
                if (typeof AOS !== 'undefined') {
                    AOS.refresh();
                }
                isLoading = false;
            }, 600);
        }, 2000);
    }
}

// ============ IMAGEN ============
function getProductImage(item) {
    const key = item.id;
    if (imageCache[key]) return imageCache[key];
    
    if (item.imagen && item.imagen.trim() !== '') {
        imageCache[key] = item.imagen;
        return item.imagen;
    }
    
    imageCache[key] = null;
    return null;
}

// ============ SKELETON ============
function renderSkeletons(count = 8) {
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    grid.innerHTML = Array(count).fill(0).map(() => `
        <div class="skeleton"></div>
    `).join('');
}

// ============ AGRUPAR PRODUCTOS CON VASO (CORREGIDO) ============
function groupProductsWithGlass(products) {
    const grouped = {};
    const glassProducts = [];
    const normalProducts = [];

    // Detectar productos con "+ vaso" o "con vaso"
    products.forEach(p => {
        if (p.nombre && (p.nombre.toLowerCase().includes('+ vaso') || p.nombre.toLowerCase().includes('con vaso'))) {
            glassProducts.push(p);
        } else {
            normalProducts.push(p);
        }
    });

    // Agrupar productos con vaso por su nombre base
    glassProducts.forEach(p => {
        let baseName = p.nombre.replace(/\s*\+\s*vaso/i, '').replace(/\s*con\s*vaso/i, '').trim();
        if (!baseName || baseName.toLowerCase() === 'vaso') {
            baseName = p.nombre;
        }

        if (!grouped[baseName]) {
            grouped[baseName] = {
                id: p.id,
                nombre: baseName,
                categoria: p.categoria,
                imagen: p.imagen,
                es_oferta: p.es_oferta,
                disponible: p.disponible,
                precio_sin_vaso: null,
                precio_con_vaso: null,
                id_sin_vaso: null,
                id_con_vaso: null,
                tiene_vaso: true,
                productos: []
            };
        }

        if (p.nombre.toLowerCase().includes('+ vaso') || p.nombre.toLowerCase().includes('con vaso')) {
            grouped[baseName].precio_con_vaso = p.precio;
            grouped[baseName].id_con_vaso = p.id;
        } else {
            grouped[baseName].precio_sin_vaso = p.precio;
            grouped[baseName].id_sin_vaso = p.id;
        }

        grouped[baseName].productos.push(p);
    });

    const groupedArray = Object.values(grouped).filter(g => {
        return g.precio_con_vaso !== null || g.precio_sin_vaso !== null;
    });

    groupedArray.forEach(g => {
        if (g.precio_sin_vaso === null && g.precio_con_vaso !== null) {
            g.precio_sin_vaso = g.precio_con_vaso;
            g.id_sin_vaso = g.id_con_vaso;
        }
        if (g.precio_con_vaso === null && g.precio_sin_vaso !== null) {
            g.precio_con_vaso = g.precio_sin_vaso;
            g.id_con_vaso = g.id_sin_vaso;
        }
        g.precio = g.precio_sin_vaso;
        g.id = g.id_sin_vaso;
    });

    return [...normalProducts, ...groupedArray];
}

// ============ CARGAR PRODUCTOS ============
async function loadProducts() {
    try {
        renderSkeletons(8);

        const SQL = await initSqlJs({
            locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${f}`
        });

        const res = await fetch('data/catalogo.db');
        if (!res.ok) throw new Error('DB no encontrada');
        const buffer = await res.arrayBuffer();

        const db = new SQL.Database(new Uint8Array(buffer));
        const result = db.exec("SELECT * FROM productos");

        if (result.length > 0) {
            const cols = result[0].columns;
            const vals = result[0].values;
            const rawProducts = vals.map(row => {
                let obj = {};
                cols.forEach((c, i) => obj[c] = row[i]);
                obj.es_oferta = !!obj.es_oferta;
                obj.disponible = !!obj.disponible;
                return obj;
            });

            menuProducts = groupProductsWithGlass(rawProducts);
            console.log(`✅ ${menuProducts.length} productos cargados`);
            console.log(`🔥 ${menuProducts.filter(p => p.es_oferta === true || p.es_oferta === 1).length} productos en oferta`);
        }

        renderCategories();
        selectDailyDrink();
        applyFilters();

        hideCinematicOverlay();

    } catch (e) {
        console.error(e);
        const grid = document.getElementById('products-grid');
        if (grid) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-12 sm:py-16 text-gray-500">
                    <i class="fa-solid fa-wifi-slash text-2xl sm:text-3xl block mb-3 sm:mb-4 opacity-30"></i>
                    <p class="text-sm sm:text-base">No se pudo cargar el catálogo</p>
                </div>
            `;
        }
        hideCinematicOverlay();
    }
}

// ============ BEBIDA DEL DÍA ============
function selectDailyDrink() {
    const today = new Date().toDateString();
    const saved = localStorage.getItem('mymDailyDrink');
    
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed.date === today) {
                dailyDrink = parsed.product;
                renderDailyDrink();
                return;
            }
        } catch (e) {}
    }
    
    const offers = menuProducts.filter(p => p.es_oferta === true || p.es_oferta === 1);
    if (offers.length > 0) {
        const randomIndex = Math.floor(Math.random() * offers.length);
        dailyDrink = offers[randomIndex];
        localStorage.setItem('mymDailyDrink', JSON.stringify({
            date: today,
            product: dailyDrink
        }));
        renderDailyDrink();
    } else {
        // Si no hay ofertas, usar el primer producto disponible
        if (menuProducts.length > 0) {
            dailyDrink = menuProducts[Math.floor(Math.random() * menuProducts.length)];
            renderDailyDrink();
        }
    }
}

function renderDailyDrink() {
    if (!dailyDrink) return;
    
    const img = document.getElementById('daily-drink-image');
    const name = document.getElementById('daily-drink-name');
    const price = document.getElementById('daily-drink-price');
    const addBtn = document.getElementById('daily-drink-add');
    
    if (img) {
        const imgUrl = getProductImage(dailyDrink);
        const tieneImagen = imgUrl && imgUrl.trim() !== '';
        
        if (tieneImagen) {
            img.src = imgUrl;
            img.alt = dailyDrink.nombre;
            img.onerror = () => {
                img.style.display = 'none';
                const parent = img.parentElement;
                const noImage = parent.querySelector('.daily-no-image');
                if (noImage) noImage.style.display = 'flex';
            };
            img.style.display = 'block';
            const noImage = img.parentElement.querySelector('.daily-no-image');
            if (noImage) noImage.style.display = 'none';
        } else {
            img.style.display = 'none';
            const parent = img.parentElement;
            let noImage = parent.querySelector('.daily-no-image');
            if (!noImage) {
                noImage = document.createElement('div');
                noImage.className = 'daily-no-image';
                noImage.innerHTML = `
                    <span>🖼️</span>
                    <p>No hay imagen<br>disponible</p>
                `;
                parent.appendChild(noImage);
            }
            noImage.style.display = 'flex';
        }
    }
    
    if (name) name.textContent = dailyDrink.nombre;
    if (price) price.textContent = `RD$ ${dailyDrink.precio.toLocaleString()}`;
    
    if (addBtn) {
        addBtn.onclick = () => addToCart(dailyDrink.id);
    }
}

// ============ CATEGORÍAS ============
function renderCategories() {
    const container = document.getElementById('categories-scroll');
    if (!container) return;

    const cats = ['all', ...new Set(menuProducts.map(p => p.categoria))];
    container.innerHTML = cats.map(cat => `
        <button onclick="filterCategory('${cat}')"
            class="cat-btn-custom ${cat === 'all' ? 'active' : ''}"
            data-cat="${cat}">
            ${cat === 'all' ? '⭐ Todos' : cat}
        </button>
    `).join('');

    setupCategoryNavigation();
}

function setupCategoryNavigation() {
    const prevBtn = document.getElementById('cat-prev');
    const nextBtn = document.getElementById('cat-next');
    const scroll = document.getElementById('categories-scroll');
    
    if (!prevBtn || !nextBtn || !scroll) return;
    
    const scrollAmount = 180;
    
    prevBtn.addEventListener('click', () => {
        scroll.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });
    
    nextBtn.addEventListener('click', () => {
        scroll.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });
}

function filterCategory(cat) {
    currentCategory = cat;
    currentPage = 1;

    document.querySelectorAll('.cat-btn-custom').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cat === cat);
    });

    applyFilters();
}

// ============ FILTRADO ============
function applyFilters() {
    let filtered = menuProducts;

    if (currentCategory !== 'all') {
        filtered = filtered.filter(p => p.categoria.toLowerCase() === currentCategory.toLowerCase());
    }

    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(p =>
            p.nombre.toLowerCase().includes(q) ||
            p.categoria.toLowerCase().includes(q)
        );
    }

    renderProducts(filtered);
}

// ============ RENDER PRODUCTOS ============
function renderProducts(allItems) {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    const total = allItems.length;
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const slice = allItems.slice(start, end);

    if (total === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-12 sm:py-16 text-gray-500">
                <i class="fa-regular fa-face-frown text-2xl sm:text-3xl block mb-3 sm:mb-4 opacity-30"></i>
                <p class="text-sm sm:text-base">No hay productos</p>
            </div>
        `;
        renderPagination(0);
        return;
    }

    grid.innerHTML = slice.map((prod, index) => {
        const img = getProductImage(prod);
        const tieneVaso = prod.tiene_vaso === true;
        const precioSinVaso = prod.precio_sin_vaso || prod.precio;
        const precioConVaso = prod.precio_con_vaso || prod.precio;
        const tieneAmbasOpciones = tieneVaso && 
            ((prod.id_sin_vaso && prod.id_con_vaso) || 
             (prod.precio_sin_vaso && prod.precio_con_vaso));

        const tieneImagen = img && img.trim() !== '';
        const esOferta = prod.es_oferta === true || prod.es_oferta === 1;
        const delay = Math.min(index * 40, 300);

        return `
            <div class="product-card" data-aos="fade-up" data-aos-duration="500" data-aos-delay="${delay}">
                <div class="img-wrap">
                    ${tieneImagen ? `
                        <img src="${img}" alt="${prod.nombre}" loading="lazy"
                            onerror="this.style.display='none'; this.parentElement.querySelector('.no-image-text').style.display='flex';" />
                    ` : ''}
                    <div class="no-image-text" style="${tieneImagen ? 'display:none;' : 'display:flex;'}">
                        <span>🖼️</span>
                        <p>No hay imagen<br>disponible</p>
                    </div>
                    ${esOferta ? `<span class="badge">🔥 Oferta</span>` : ''}
                    ${tieneVaso ? `<span class="badge-vaso">🥃 +Vaso</span>` : ''}
                </div>
                <span class="category-tag">${prod.categoria}</span>
                <h4 class="product-name">${prod.nombre}</h4>
                
                ${tieneAmbasOpciones ? `
                    <div class="mt-2 flex flex-col gap-1.5">
                        <div class="flex items-center justify-between text-xs">
                            <span class="text-gray-400">Sin vaso</span>
                            <span class="text-white font-semibold">RD$ ${precioSinVaso.toLocaleString()}</span>
                            <button onclick="addToCartWithGlass('${prod.id_sin_vaso || prod.id}', false)" 
                                class="add-btn-small">+</button>
                        </div>
                        <div class="flex items-center justify-between text-xs border-t border-white/5 pt-1.5">
                            <span class="text-gray-400">Con vaso 🥃</span>
                            <span class="text-gold-400 font-semibold">RD$ ${precioConVaso.toLocaleString()}</span>
                            <button onclick="addToCartWithGlass('${prod.id_con_vaso || prod.id}', true)" 
                                class="add-btn-small gold">+</button>
                        </div>
                    </div>
                ` : `
                    <div class="flex items-center justify-between mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-white/5">
                        <span class="price">RD$ ${prod.precio.toLocaleString()}</span>
                        <button onclick="addToCart('${prod.id}')" class="add-btn">
                            <i class="fa-solid fa-plus text-xs sm:text-sm"></i>
                        </button>
                    </div>
                `}
            </div>
        `;
    }).join('');

    renderPagination(total);
    if (typeof AOS !== 'undefined') AOS.refresh();
}

// ============ PAGINACIÓN ============
function renderPagination(total) {
    const container = document.getElementById('paginationContainer');
    if (!container) return;

    const pages = Math.ceil(total / itemsPerPage) || 1;
    if (pages <= 1) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div class="flex items-center justify-center gap-3 sm:gap-4 pt-6 sm:pt-8">
            <button onclick="changePage(${currentPage - 1})"
                ${currentPage === 1 ? 'disabled' : ''}
                class="px-4 sm:px-5 py-1.5 sm:py-2 rounded-xl bg-white/5 text-white disabled:opacity-30 hover:bg-white/10 transition-all duration-300 hover:scale-105 text-xs sm:text-sm font-medium">
                ← Anterior
            </button>
            <span class="text-xs sm:text-sm text-gray-400">${currentPage} / ${pages}</span>
            <button onclick="changePage(${currentPage + 1})"
                ${currentPage === pages ? 'disabled' : ''}
                class="px-4 sm:px-5 py-1.5 sm:py-2 rounded-xl bg-white/5 text-white disabled:opacity-30 hover:bg-white/10 transition-all duration-300 hover:scale-105 text-xs sm:text-sm font-medium">
                Siguiente →
            </button>
        </div>
    `;
}

function changePage(page) {
    currentPage = page;
    applyFilters();
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============ BÚSQUEDA ============
let searchTimeout;

function handleSearch(e) {
    clearTimeout(searchTimeout);
    searchQuery = e.target.value;
    searchTimeout = setTimeout(() => {
        currentPage = 1;
        applyFilters();
    }, 300);
}

// ============ CARRITO ============
function addToCart(id) {
    const item = menuProducts.find(p => p.id === id);
    if (!item) return;

    const existing = cart.find(p => p.id === id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ ...item, quantity: 1 });
    }

    updateCartUI();
    saveCartData();
    showToast(`"${item.nombre}" añadido`);
}

function addToCartWithGlass(id, conVaso) {
    let item = menuProducts.find(p => p.id === id);
    
    if (!item) {
        for (const p of menuProducts) {
            if (p.id_sin_vaso === id || p.id_con_vaso === id) {
                item = p;
                break;
            }
        }
    }
    
    if (!item) {
        showToast("Producto no encontrado");
        return;
    }

    let nombreMostrar = item.nombre;
    if (item.tiene_vaso) {
        nombreMostrar = conVaso ? `${item.nombre} + Vaso 🥃` : `${item.nombre} (sin vaso)`;
    }

    let precio = item.precio;
    if (item.tiene_vaso) {
        precio = conVaso ? (item.precio_con_vaso || item.precio) : (item.precio_sin_vaso || item.precio);
    }

    const cartItem = {
        id: id,
        nombre: nombreMostrar,
        categoria: item.categoria,
        imagen: item.imagen,
        precio: precio,
        es_oferta: item.es_oferta,
        quantity: 1,
        tiene_vaso: item.tiene_vaso || false,
        con_vaso: conVaso || false,
        id_original: item.id_original || id
    };

    const existing = cart.find(p => p.id === id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push(cartItem);
    }

    updateCartUI();
    saveCartData();
    showToast(`"${nombreMostrar}" añadido`);
}

function updateCartQuantity(id, change) {
    const item = cart.find(p => p.id === id);
    if (!item) return;

    item.quantity += change;
    if (item.quantity <= 0) {
        cart = cart.filter(p => p.id !== id);
    }

    updateCartUI();
    saveCartData();
}

function updateCartUI() {
    const badge = document.getElementById('cart-count');
    const totalText = document.getElementById('cart-total');
    const container = document.getElementById('cart-items-container');

    const totalCount = cart.reduce((acc, curr) => acc + curr.quantity, 0);
    const totalPrice = cart.reduce((acc, curr) => acc + (curr.precio * curr.quantity), 0);

    if (badge) badge.textContent = totalCount;
    if (totalText) totalText.textContent = `RD$ ${totalPrice.toLocaleString()}`;

    if (container) {
        if (cart.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 sm:py-12 text-gray-500 space-y-2 sm:space-y-3">
                    <i class="fa-solid fa-wine-bottle text-3xl sm:text-4xl block opacity-20"></i>
                    <p class="text-sm sm:text-base">El carrito está vacío</p>
                </div>
            `;
            return;
        }

        container.innerHTML = cart.map((item, index) => {
            const img = getProductImage(item);
            const tieneImagen = img && img.trim() !== '';
            const esConVaso = item.con_vaso === true;
            return `
                <div class="cart-item flex items-center space-x-3 sm:space-x-4 bg-white/[0.02] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-white/[0.04]" style="animation-delay: ${index * 40}ms">
                    ${tieneImagen ? `
                        <img src="${img}" alt="${item.nombre}"
                            class="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl object-cover"
                            onerror="this.style.display='none'; this.parentElement.querySelector('.cart-no-image').style.display='flex';" />
                    ` : ''}
                    <div class="cart-no-image" style="${tieneImagen ? 'display:none;' : 'display:flex;'} width:40px; height:40px; border-radius:8px; background:#0a0a0f; align-items:center; justify-content:center; flex-shrink:0; font-size:10px; color:#555; text-align:center; flex-direction:column; line-height:1.2;">
                        <span>🖼️</span>
                        <span style="font-size:6px;">sin img</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h5 class="text-xs sm:text-sm font-bold text-white truncate">${item.nombre}</h5>
                        <p class="text-[10px] sm:text-xs text-gold-400">
                            RD$ ${item.precio.toLocaleString()} x ${item.quantity}
                            ${esConVaso ? ' 🥃' : ''}
                        </p>
                    </div>
                    <div class="flex items-center space-x-1 sm:space-x-2">
                        <button onclick="updateCartQuantity('${item.id}', -1)"
                            class="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-all duration-300 hover:scale-110 text-xs sm:text-sm">−</button>
                        <span class="text-xs sm:text-sm w-4 sm:w-5 text-center">${item.quantity}</span>
                        <button onclick="updateCartQuantity('${item.id}', 1)"
                            class="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-all duration-300 hover:scale-110 text-xs sm:text-sm">+</button>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function toggleCartModal() {
    const modal = document.getElementById('cart-modal');
    const backdrop = document.getElementById('cart-backdrop');
    const sheet = document.getElementById('cart-sheet');

    if (!modal) return;

    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        requestAnimationFrame(() => {
            if (backdrop) backdrop.classList.replace('opacity-0', 'opacity-100');
            if (sheet) sheet.classList.remove('translate-x-full');
        });
    } else {
        if (backdrop) backdrop.classList.replace('opacity-100', 'opacity-0');
        if (sheet) sheet.classList.add('translate-x-full');
        setTimeout(() => modal.classList.add('hidden'), 400);
    }
}

function saveCartData() {
    localStorage.setItem('mymCart_v2', JSON.stringify(cart));
}

// ============ WHATSAPP CHECKOUT ============
function openNameModal() {
    if (cart.length === 0) {
        showToast("Agrega productos primero");
        return;
    }

    const modal = document.getElementById('name-modal');
    const content = document.getElementById('name-modal-content');

    if (modal) {
        modal.classList.remove('hidden');
        requestAnimationFrame(() => {
            if (content) {
                content.classList.remove('scale-95', 'opacity-0');
                content.classList.add('scale-100', 'opacity-100');
            }
        });
    }
}

function closeNameModal() {
    const modal = document.getElementById('name-modal');
    const content = document.getElementById('name-modal-content');

    if (content) {
        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-95', 'opacity-0');
    }

    setTimeout(() => {
        if (modal) modal.classList.add('hidden');
    }, 400);
}

function confirmSendOrder() {
    const nameInput = document.getElementById('customerName');
    const name = nameInput ? nameInput.value.trim() : "";

    if (!name) {
        alert("Ingresa tu nombre");
        return;
    }

    let message = `*NUEVO PEDIDO - M&M DRINK LIQUOR*\n*Cliente:* ${name}\n-------------------------------------------\n`;

    cart.forEach(item => {
        const conVaso = item.con_vaso ? ' 🥃 con vaso' : '';
        message += `• ${item.quantity}x ${item.nombre}${conVaso}\n  Subtotal: RD$ ${(item.precio * item.quantity).toLocaleString()}\n`;
    });

    const total = cart.reduce((acc, curr) => acc + (curr.precio * curr.quantity), 0);
    message += `-------------------------------------------\n*TOTAL:* RD$ ${total.toLocaleString()}\n\n_Para confirmar disponibilidad y envío._`;

    const url = `https://wa.me/${DEFAULT_WHATSAPP}?text=${encodeURIComponent(message)}`;

    cart = [];
    saveCartData();
    updateCartUI();
    closeNameModal();
    toggleCartModal();

    window.open(url, '_blank');
    showToast("Pedido enviado ✅");
}

// ============ TOAST ============
function showToast(message) {
    const toast = document.getElementById('toast-notification');
    const msgSpan = document.getElementById('toastMessage');

    if (toast && msgSpan) {
        msgSpan.textContent = message;
        toast.classList.add('show');
        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => toast.classList.remove('show'), 2500);
    }
}

// ============ HEADER SCROLL ============
function handleHeaderScroll() {
    const header = document.getElementById('main-header');
    if (header) {
        const scrolled = window.scrollY > 50;
        if (scrolled !== header._scrolled) {
            header._scrolled = scrolled;
            header.classList.toggle('scrolled', scrolled);
        }
    }
}

// ============ COMPARTIR CATÁLOGO ============
function shareCatalog() {
    const url = window.location.href;
    const message = `🍷 ¡Mira el catálogo de M&M Drink Liquor! 🍷\n\nElige tus bebidas favoritas, arma tu pedido y recíbelo donde estés en Santo Domingo.\n\n📱 ${url}\n\n🔥 ¡Pide ahora por WhatsApp!`;
    
    if (navigator.share) {
        navigator.share({
            title: 'M&M Drink Liquor · Catálogo Premium',
            text: '🍷 ¡Mira el catálogo de M&M Drink Liquor! Elige tus bebidas favoritas y recíbelo donde estés.',
            url: url
        }).catch(() => {});
    } else {
        navigator.clipboard.writeText(`${message}`).then(() => {
            showToast('📋 ¡Enlace copiado! Compártelo con tus amigos');
        }).catch(() => {
            window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
        });
    }
}

// ============ INICIALIZACIÓN ============
document.addEventListener('DOMContentLoaded', () => {
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 500,
            easing: 'ease-out-cubic',
            once: true,
            offset: 30,
            disable: window.innerWidth < 768 ? true : false,
        });
    }

    renderSkeletons(8);
    loadProducts();

    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', handleSearch);

    window.addEventListener('scroll', handleHeaderScroll, { passive: true });

    const saved = localStorage.getItem('mymCart_v2');
    if (saved) {
        try { cart = JSON.parse(saved); } catch (e) { cart = []; }
    }
    setTimeout(() => updateCartUI(), 150);
});