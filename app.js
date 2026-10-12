// ================= DATA PRODUK (SEKARANG PERSISTEN DI localStorage) =================
// Data default hanya dipakai sekali di awal (jika localStorage masih kosong).
// Setelah itu, seluruh perubahan (tambah/edit/gambar/status) disimpan di key 'menuData'.
const defaultMenuData = [
    { id: 1, nama: "Paket Panas 1 (Ayam + Nasi + Es Teh)", harga: 45000, kategori: "Paket Hemat", img: "🍗", status: "tersedia" },
    { id: 2, nama: "Paket Panas 2 (2 Ayam + Nasi + Es Teh)", harga: 58000, kategori: "Paket Hemat", img: "🍗", status: "tersedia" },
    { id: 3, nama: "Big Mac Meal (Burger + Fries + Cola)", harga: 72000, kategori: "Burger", img: "🍔", status: "tersedia" },
    { id: 4, nama: "Double Cheeseburger", harga: 42000, kategori: "Burger", img: "🍔", status: "tersedia" },
    { id: 5, nama: "Fish Fillet Burger", harga: 38000, kategori: "Burger", img: "🍔", status: "tersedia" },
    { id: 6, nama: "Chicken McNuggets (6 pcs)", harga: 35000, kategori: "Sides", img: "🍟", status: "tersedia" },
    { id: 7, nama: "French Fries (Large)", harga: 28000, kategori: "Sides", img: "🍟", status: "tersedia" },
    { id: 8, nama: "McFlurry OREO", harga: 16000, kategori: "Dessert", img: "🍦", status: "tersedia" },
    { id: 9, nama: "Apple Pie", harga: 14000, kategori: "Dessert", img: "🥧", status: "tersedia" },
    { id: 10, nama: "Coca Cola (Medium)", harga: 15000, kategori: "Minuman", img: "🥤", status: "tersedia" },
    { id: 11, nama: "Fanta Strawberry (Medium)", harga: 15000, kategori: "Minuman", img: "🥤", status: "tersedia" },
    { id: 12, nama: "Iced Milo (Medium)", harga: 20000, kategori: "Minuman", img: "🧋", status: "tersedia" }
];

// Ambil data menu terkini dari localStorage. Jika belum ada, seed dari defaultMenuData.
function getMenuData() {
    let data = JSON.parse(localStorage.getItem('menuData'));
    if (!data) {
        data = defaultMenuData;
        localStorage.setItem('menuData', JSON.stringify(data));
    }
    return data;
}

// Simpan perubahan data menu (dipakai oleh fitur Kelola Produk di index.html)
function saveMenuData(data) {
    localStorage.setItem('menuData', JSON.stringify(data));
}

// ================= INVENTORI BAHAN BAKU =================
// Struktur bahan baku (key 'bahanBaku'): { id, nama, satuan, stok, stokMin }
// Resep disimpan di dalam data menu: menu.resep = [{ bahanId, qty }]  (qty = pemakaian per 1 porsi)
// Log perubahan stok disimpan di key 'logStokBahan'.
function getBahanBaku() {
    return JSON.parse(localStorage.getItem('bahanBaku')) || [];
}

function saveBahanBaku(data) {
    localStorage.setItem('bahanBaku', JSON.stringify(data));
}

function getLogStok() {
    return JSON.parse(localStorage.getItem('logStokBahan')) || [];
}

// jenis: 'Stok Awal' | 'Tambah Stok' | 'Koreksi' | 'Transaksi' | 'Hapus'
function catatLogStok(entry) {
    const log = getLogStok();
    log.unshift({
        waktu: new Date().toLocaleString('id-ID'),
        ...entry
    });
    localStorage.setItem('logStokBahan', JSON.stringify(log.slice(0, 300))); // simpan 300 log terakhir
}

// Hitung total kebutuhan bahan dari daftar item (keranjang / pesanan)
// Hasil: { [bahanId]: totalQty }
function hitungKebutuhanBahan(items) {
    const menu = getMenuData();
    const kebutuhan = {};
    items.forEach(it => {
        const m = menu.find(x => x.id === it.id);
        const resep = (m && m.resep) ? m.resep : (it.resep || []);
        resep.forEach(r => {
            kebutuhan[r.bahanId] = (kebutuhan[r.bahanId] || 0) + (r.qty * it.qty);
        });
    });
    return kebutuhan;
}

// Cek apakah stok bahan cukup untuk daftar item. Return { ok, kurang: [...] }
function cekKetersediaanBahan(items) {
    const kebutuhan = hitungKebutuhanBahan(items);
    const bahan = getBahanBaku();
    const kurang = [];
    Object.keys(kebutuhan).forEach(id => {
        const b = bahan.find(x => x.id === parseInt(id));
        if (!b) return; // bahan sudah dihapus, abaikan
        if (b.stok + 1e-9 < kebutuhan[id]) {
            kurang.push({ nama: b.nama, butuh: kebutuhan[id], ada: b.stok, satuan: b.satuan });
        }
    });
    return { ok: kurang.length === 0, kurang };
}

function formatPesanKurang(kurang) {
    return kurang.map(k => `- ${k.nama}: butuh ${k.butuh} ${k.satuan}, sisa ${k.ada} ${k.satuan}`).join('\n');
}

// Maksimal porsi yang masih bisa dibuat dari stok saat ini. Return null jika produk tanpa resep.
function maksPorsiProduk(menuItem) {
    if (!menuItem.resep || menuItem.resep.length === 0) return null;
    const bahan = getBahanBaku();
    let min = Infinity;
    menuItem.resep.forEach(r => {
        const b = bahan.find(x => x.id === r.bahanId);
        if (!b || r.qty <= 0) return;
        min = Math.min(min, Math.floor((b.stok + 1e-9) / r.qty));
    });
    return min === Infinity ? null : min;
}

// Kurangi stok bahan otomatis berdasarkan pesanan. Return daftar bahan yang menipis/habis.
function kurangiStokBahan(items, orderId) {
    const kebutuhan = hitungKebutuhanBahan(items);
    const bahan = getBahanBaku();
    const peringatan = [];

    Object.keys(kebutuhan).forEach(id => {
        const b = bahan.find(x => x.id === parseInt(id));
        if (!b) return;
        const jumlah = kebutuhan[id];
        b.stok = Math.max(0, Math.round((b.stok - jumlah) * 1000) / 1000);
        catatLogStok({
            bahanId: b.id, nama: b.nama, satuan: b.satuan,
            jenis: 'Transaksi', jumlah: -jumlah, stokAkhir: b.stok,
            ket: `Pesanan ${orderId}`
        });
        if (b.stok <= 0) peringatan.push(`${b.nama} HABIS`);
        else if (b.stok <= b.stokMin) peringatan.push(`${b.nama} menipis (sisa ${b.stok} ${b.satuan})`);
    });

    saveBahanBaku(bahan);
    return peringatan;
}
// ================= END INVENTORI BAHAN BAKU =================

// ================= INVENTORI OTOMATIS DARI MENU BAWAAN =================
// Daftar bahan baku default (nama, satuan, stok awal, stok minimum)
const defaultBahanBaku = [
    { nama: "Ayam Goreng",        satuan: "pcs",    stok: 100,   stokMin: 20 },
    { nama: "Nasi Putih",         satuan: "gram",   stok: 15000, stokMin: 3000 },
    { nama: "Teh Celup",          satuan: "pcs",    stok: 100,   stokMin: 20 },
    { nama: "Gula Pasir",         satuan: "gram",   stok: 3000,  stokMin: 500 },
    { nama: "Es Batu",            satuan: "gram",   stok: 30000, stokMin: 5000 },
    { nama: "Gelas Cup",          satuan: "pcs",    stok: 300,   stokMin: 50 },
    { nama: "Roti Burger (Bun)",  satuan: "pcs",    stok: 80,    stokMin: 15 },
    { nama: "Patty Daging Sapi",  satuan: "pcs",    stok: 150,   stokMin: 30 },
    { nama: "Keju Slice",         satuan: "lembar", stok: 150,   stokMin: 30 },
    { nama: "Selada",             satuan: "gram",   stok: 2000,  stokMin: 400 },
    { nama: "Saus Burger",        satuan: "ml",     stok: 3000,  stokMin: 500 },
    { nama: "Fillet Ikan",        satuan: "pcs",    stok: 40,    stokMin: 10 },
    { nama: "Kentang Goreng Beku",satuan: "gram",   stok: 20000, stokMin: 4000 },
    { nama: "Nugget Ayam",        satuan: "pcs",    stok: 300,   stokMin: 60 },
    { nama: "Es Krim Vanilla",    satuan: "gram",   stok: 5000,  stokMin: 1000 },
    { nama: "Remahan Oreo",       satuan: "gram",   stok: 1000,  stokMin: 200 },
    { nama: "Apple Pie (Beku)",   satuan: "pcs",    stok: 60,    stokMin: 12 },
    { nama: "Sirup Cola",         satuan: "ml",     stok: 5000,  stokMin: 1000 },
    { nama: "Sirup Strawberry",   satuan: "ml",     stok: 3000,  stokMin: 600 },
    { nama: "Air Soda",           satuan: "ml",     stok: 20000, stokMin: 4000 },
    { nama: "Bubuk Milo",         satuan: "gram",   stok: 2000,  stokMin: 400 },
    { nama: "Susu Cair",          satuan: "ml",     stok: 5000,  stokMin: 1000 }
];

// Resep default per menu (kunci = nama menu, qty = pemakaian per 1 porsi)
const defaultResepMenu = {
    "Paket Panas 1 (Ayam + Nasi + Es Teh)":   [["Ayam Goreng",1],["Nasi Putih",150],["Teh Celup",1],["Gula Pasir",15],["Es Batu",100],["Gelas Cup",1]],
    "Paket Panas 2 (2 Ayam + Nasi + Es Teh)": [["Ayam Goreng",2],["Nasi Putih",150],["Teh Celup",1],["Gula Pasir",15],["Es Batu",100],["Gelas Cup",1]],
    "Big Mac Meal (Burger + Fries + Cola)":   [["Roti Burger (Bun)",1],["Patty Daging Sapi",2],["Keju Slice",1],["Selada",20],["Saus Burger",20],["Kentang Goreng Beku",100],["Sirup Cola",40],["Air Soda",250],["Es Batu",100],["Gelas Cup",1]],
    "Double Cheeseburger":                    [["Roti Burger (Bun)",1],["Patty Daging Sapi",2],["Keju Slice",2],["Saus Burger",15]],
    "Fish Fillet Burger":                     [["Roti Burger (Bun)",1],["Fillet Ikan",1],["Keju Slice",1],["Saus Burger",20]],
    "Chicken McNuggets (6 pcs)":              [["Nugget Ayam",6],["Saus Burger",20]],
    "French Fries (Large)":                   [["Kentang Goreng Beku",150]],
    "McFlurry OREO":                          [["Es Krim Vanilla",150],["Remahan Oreo",30],["Gelas Cup",1]],
    "Apple Pie":                              [["Apple Pie (Beku)",1]],
    "Coca Cola (Medium)":                     [["Sirup Cola",40],["Air Soda",250],["Es Batu",100],["Gelas Cup",1]],
    "Fanta Strawberry (Medium)":              [["Sirup Strawberry",40],["Air Soda",250],["Es Batu",100],["Gelas Cup",1]],
    "Iced Milo (Medium)":                     [["Bubuk Milo",30],["Susu Cair",100],["Es Batu",100],["Gelas Cup",1]]
};

// Melengkapi inventori sesuai menu yang ada:
// - menambahkan bahan default yang belum ada (stok bahan yang sudah ada TIDAK diubah)
// - mengisi resep untuk menu yang resepnya masih kosong (resep yang sudah diisi admin TIDAK ditimpa)
// Return { bahanBaru, resepBaru }
function muatInventoriDefault() {
    const bahan = getBahanBaku();
    let bahanBaru = 0;

    defaultBahanBaku.forEach(d => {
        if (!bahan.some(b => b.nama.toLowerCase() === d.nama.toLowerCase())) {
            const id = bahan.length > 0 ? Math.max(...bahan.map(b => b.id)) + 1 : 1;
            bahan.push({ id, ...d });
            catatLogStok({ bahanId: id, nama: d.nama, satuan: d.satuan, jenis: 'Stok Awal', jumlah: d.stok, stokAkhir: d.stok, ket: 'Otomatis dari menu bawaan' });
            bahanBaru++;
        }
    });
    saveBahanBaku(bahan);

    let resepBaru = 0;
    const menu = getMenuData().map(m => {
        const def = defaultResepMenu[m.nama];
        if (def && (!m.resep || m.resep.length === 0)) {
            const resep = [];
            def.forEach(([namaBahan, qty]) => {
                const b = bahan.find(x => x.nama.toLowerCase() === namaBahan.toLowerCase());
                if (b) resep.push({ bahanId: b.id, qty });
            });
            if (resep.length > 0) { resepBaru++; return { ...m, resep }; }
        }
        return m;
    });
    saveMenuData(menu);
    return { bahanBaru, resepBaru };
}

// Dijalankan otomatis sekali saja saat aplikasi pertama dibuka
function inisialisasiInventori() {
    if (localStorage.getItem('inventoriDefaultDimuat')) return;
    muatInventoriDefault();
    localStorage.setItem('inventoriDefaultDimuat', '1');
}
// ================= END INVENTORI OTOMATIS =================


let cart = [];
let currentFilter = "Semua";

function initKasir() {
    inisialisasiInventori();
    renderMenu();
    updateCart();
    
    const searchInput = document.getElementById('search-menu');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderMenu(e.target.value, currentFilter);
        });
    }
}

function filterKategori(kategori, btnElement) {
    currentFilter = kategori;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active', 'btn-danger'));
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.add('btn-outline-danger'));
    btnElement.classList.remove('btn-outline-danger');
    btnElement.classList.add('active', 'btn-danger');
    
    const searchInput = document.getElementById('search-menu') ? document.getElementById('search-menu').value : '';
    renderMenu(searchInput, currentFilter);
}

function renderMenu(keyword = '', kategori = 'Semua') {
    const menuList = document.getElementById('menu-list');
    if (!menuList) return;
    
    menuList.innerHTML = '';

    const dataMenu = getMenuData();
    
    let filtered = dataMenu.filter(item => {
        let matchKeyword = item.nama.toLowerCase().includes(keyword.toLowerCase());
        let matchKategori = (kategori === 'Semua' || item.kategori === kategori);
        return matchKeyword && matchKategori;
    });

    if (filtered.length === 0) {
        menuList.innerHTML = `<div class="col-12 text-center text-muted py-5"><h5>Menu tidak ditemukan</h5></div>`;
        return;
    }

    filtered.forEach(item => {
        const porsi = maksPorsiProduk(item);
        const bahanHabis = (porsi !== null && porsi <= 0);
        const isKosong = item.status === 'kosong' || bahanHabis;
        // Gambar bisa berupa emoji (default) ATAU gambar upload (base64/URL)
        const isGambarAsli = item.img && (item.img.indexOf('data:image') === 0 || item.img.indexOf('http') === 0);
        const gambarHtml = isGambarAsli
            ? `<img src="${item.img}" class="mb-2" style="width:70px;height:70px;object-fit:cover;border-radius:10px;">`
            : `<div class="display-4 mb-2">${item.img}</div>`;

        menuList.innerHTML += `
            <div class="col-md-4 mb-3">
                <div class="card menu-card h-100 shadow-sm border-0 position-relative ${isKosong ? 'opacity-50' : ''}"
                     ${isKosong ? '' : `onclick="tambahKeKeranjang(${item.id})"`}
                     style="cursor: ${isKosong ? 'not-allowed' : 'pointer'}; transition: transform 0.2s;">
                    ${isKosong ? `<span class="badge bg-dark position-absolute top-0 end-0 m-2">${bahanHabis ? 'BAHAN HABIS' : 'HABIS'}</span>` : ''}
                    <div class="card-body text-center d-flex flex-column justify-content-between bg-white rounded-3">
                        <div>
                            ${gambarHtml}
                            <h6 class="card-title fw-bold text-dark">${item.nama}</h6>
                            <span class="badge bg-light text-secondary border mb-2">${item.kategori}</span>
                            ${(porsi !== null && porsi > 0) ? `<div class="small ${porsi <= 5 ? 'text-danger' : 'text-muted'}">Sisa bahan: ${porsi} porsi</div>` : ''}
                        </div>
                        <div class="mt-2">
                            <span class="text-danger fw-bold fs-5">Rp ${item.harga.toLocaleString('id-ID')}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
}

function tambahKeKeranjang(id) {
    const dataMenu = getMenuData();
    const item = dataMenu.find(m => m.id === id);
    if (!item) return;

    if (item.status === 'kosong') {
        alert('Maaf, produk ini sedang berstatus Kosong/Sold dan belum bisa dipesan.');
        return;
    }

    if (item.resep && item.resep.length > 0 && maksPorsiProduk(item) <= 0) {
        alert('Maaf, bahan baku untuk produk ini sudah habis.');
        return;
    }

    const existing = cart.find(c => c.id === id);
    const cartBaru = existing
        ? cart.map(c => c.id === id ? { ...c, qty: c.qty + 1 } : c)
        : [...cart, { ...item, qty: 1 }];

    // Validasi stok bahan baku untuk seluruh isi keranjang
    const cek = cekKetersediaanBahan(cartBaru);
    if (!cek.ok) {
        alert('Stok bahan baku tidak mencukupi:\n' + formatPesanKurang(cek.kurang));
        return;
    }

    if (existing) {
        existing.qty++;
    } else {
        cart.push({ ...item, qty: 1 });
    }
    updateCart();
}

function ubahQty(index, change) {
    if (change > 0) {
        const cartBaru = cart.map((c, i) => i === index ? { ...c, qty: c.qty + change } : c);
        const cek = cekKetersediaanBahan(cartBaru);
        if (!cek.ok) {
            alert('Stok bahan baku tidak mencukupi:\n' + formatPesanKurang(cek.kurang));
            return;
        }
    }
    cart[index].qty += change;
    if (cart[index].qty <= 0) {
        cart.splice(index, 1);
    }
    updateCart();
}

function updateCart() {
    const cartContainer = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');
    const subtotalEl = document.getElementById('subtotal');
    const taxEl = document.getElementById('tax');
    const itemCountEl = document.getElementById('item-count');
    
    if (!cartContainer) return;

    if (cart.length === 0) {
        cartContainer.innerHTML = '<p class="text-muted text-center my-4">Belum ada item dipilih.</p>';
        if (cartTotal) cartTotal.innerText = 'Rp 0';
        if (subtotalEl) subtotalEl.innerText = 'Rp 0';
        if (taxEl) taxEl.innerText = 'Rp 0';
        if (itemCountEl) itemCountEl.innerText = '0 Item';
        return;
    }

    cartContainer.innerHTML = '';
    let subtotal = 0;
    let totalItems = 0;

    cart.forEach((item, index) => {
        let itemTotal = item.harga * item.qty;
        subtotal += itemTotal;
        totalItems += item.qty;
        
        cartContainer.innerHTML += `
            <div class="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                <div style="flex: 2;">
                    <h6 class="mb-0 fw-bold text-dark">${item.nama}</h6>
                    <small class="text-muted">Rp ${item.harga.toLocaleString('id-ID')} x ${item.qty}</small>
                </div>
                <div class="d-flex align-items-center" style="flex: 1; justify-content: flex-end;">
                    <button class="btn btn-sm btn-outline-secondary px-2 py-0 fw-bold" onclick="ubahQty(${index}, -1)">-</button>
                    <span class="mx-2 fw-bold">${item.qty}</span>
                    <button class="btn btn-sm btn-outline-secondary px-2 py-0 fw-bold" onclick="ubahQty(${index}, 1)">+</button>
                </div>
            </div>
        `;
    });

    let tax = subtotal * 0.10;
    let total = subtotal + tax;

    if (subtotalEl) subtotalEl.innerText = `Rp ${subtotal.toLocaleString('id-ID')}`;
    if (taxEl) taxEl.innerText = `Rp ${tax.toLocaleString('id-ID')}`;
    if (cartTotal) cartTotal.innerText = `Rp ${total.toLocaleString('id-ID')}`;
    if (itemCountEl) itemCountEl.innerText = `${totalItems} Item`;
}

function bukaModalPembayaran() {
    const customerName = document.getElementById('customer-name').value.trim();

    if (!customerName) {
        alert('Mohon masukkan Nama Pelanggan / No. Meja terlebih dahulu!');
        document.getElementById('customer-name').focus();
        return;
    }
    if (cart.length === 0) {
        alert('Keranjang pesanan masih kosong!');
        return;
    }

    let subtotal = cart.reduce((sum, item) => sum + (item.harga * item.qty), 0);
    let tax = subtotal * 0.10;
    let total = subtotal + tax;

    document.getElementById('pay-total').innerText = `Rp ${total.toLocaleString('id-ID')}`;
    document.getElementById('bayar-tunai-input').value = '';
    document.getElementById('kembalian-display').innerText = 'Rp 0';

    var payModal = new bootstrap.Modal(document.getElementById('paymentModal'));
    payModal.show();
}

function pilihMetode(metode) {
    document.querySelectorAll('.payment-tab').forEach(el => el.classList.remove('border-danger', 'bg-light'));
    event.currentTarget.classList.add('border-danger', 'bg-light');
    
    document.getElementById('form-tunai').style.display = 'none';
    document.getElementById('form-qris').style.display = 'none';
    document.getElementById('form-debit').style.display = 'none';

    if (metode === 'Tunai') {
        document.getElementById('form-tunai').style.display = 'block';
    } else if (metode === 'QRIS') {
        document.getElementById('form-qris').style.display = 'block';
    } else if (metode === 'Debit/Credit' || metode === 'E-Wallet') {
        document.getElementById('form-debit').style.display = 'block';
    }
    window.selectedPaymentMethod = metode;
}

function hitungKembalian() {
    let subtotal = cart.reduce((sum, item) => sum + (item.harga * item.qty), 0);
    let total = subtotal + (subtotal * 0.10);
    let bayar = parseFloat(document.getElementById('bayar-tunai-input').value) || 0;
    let kembalian = bayar - total;

    const kembalianEl = document.getElementById('kembalian-display');
    if (kembalian >= 0) {
        kembalianEl.innerText = `Rp ${kembalian.toLocaleString('id-ID')}`;
        kembalianEl.classList.remove('text-danger');
        kembalianEl.classList.add('text-success');
    } else {
        kembalianEl.innerText = `Kurang Rp ${Math.abs(kembalian).toLocaleString('id-ID')}`;
        kembalianEl.classList.remove('text-success');
        kembalianEl.classList.add('text-danger');
    }
}

function prosesTransaksiFinal() {
    const customerName = document.getElementById('customer-name').value.trim();
    const orderType = document.getElementById('order-type').value;
    const paymentMethod = window.selectedPaymentMethod || 'Tunai';

    let subtotal = cart.reduce((sum, item) => sum + (item.harga * item.qty), 0);
    let tax = subtotal * 0.10;
    let total = subtotal + tax;

    if (paymentMethod === 'Tunai') {
        let bayar = parseFloat(document.getElementById('bayar-tunai-input').value) || 0;
        if (bayar < total) {
            alert('Jumlah uang tunai kurang dari total tagihan!');
            return;
        }
    }

    // Validasi ulang stok bahan baku sebelum transaksi diselesaikan
    const cekStok = cekKetersediaanBahan(cart);
    if (!cekStok.ok) {
        alert('Transaksi dibatalkan, stok bahan baku tidak mencukupi:\n' + formatPesanKurang(cekStok.kurang));
        return;
    }

    const orderId = 'MCD-' + Math.floor(100000 + Math.random() * 900000);
    const newOrder = {
        id: orderId,
        customer: customerName,
        type: orderType,
        items: [...cart],
        subtotal: subtotal,
        tax: tax,
        total: total,
        paymentMethod: paymentMethod,
        status: 'Pending',
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString('id-ID')
    };

    const orders = JSON.parse(localStorage.getItem('kitchenOrders')) || [];
    orders.push(newOrder);
    localStorage.setItem('kitchenOrders', JSON.stringify(orders));
    localStorage.setItem('lastTransaction', JSON.stringify(newOrder));

    // Kurangi stok bahan baku otomatis sesuai resep tiap produk yang dipesan
    const peringatanStok = kurangiStokBahan(newOrder.items, orderId);

    var modalEl = document.getElementById('paymentModal');
    var modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();

    cart = [];
    document.getElementById('customer-name').value = '';
    updateCart();
    renderMenu(); // refresh status/sisa porsi menu setelah stok bahan berkurang
    if (typeof renderTabelBahan === 'function') renderTabelBahan();

    if (peringatanStok.length > 0) {
        alert('⚠️ Peringatan Stok Bahan Baku:\n- ' + peringatanStok.join('\n- '));
    }

    if (confirm(`Transaksi Sukses! No Pesanan: ${orderId}\nCetak Struk Pembayaran Sekarang?`)) {
        window.open('struk.html', '_blank');
    }
}