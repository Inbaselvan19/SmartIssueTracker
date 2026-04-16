        // Global state
        let apiToken = null;
        let currentUser = null;
        let currentUserType = null;
        let problems = [];
        let citizens = [];
        let officials = [];
        let capturedImageBlob = null;
        let citizenChartInstance = null;
        let officialChartInstance = null;
        let videoStream = null;
        let pendingAuthData = null;

        const API_BASE = 'http://localhost:3000/api';

        async function apiFetch(endpoint, method = 'GET', body = null) {
            const headers = { 'Content-Type': 'application/json' };
            if (apiToken) headers['Authorization'] = 'Bearer ' + apiToken;
            const res = await fetch(API_BASE + endpoint, { method, headers, body: body ? JSON.stringify(body) : null });
            if (!res.ok) {
                let err;
                try { err = (await res.json()).error; } catch (e) { err = res.statusText; }
                throw new Error(err);
            }
            return res.json();
        }

        async function syncData() {
            try {
                if (currentUserType === 'admin') {
                    const res = await apiFetch('/users');
                    citizens = res.citizens || [];
                    officials = res.officials || [];
                    problems = await apiFetch('/problems');
                } else {
                    problems = await apiFetch('/problems');
                }
            } catch (e) {
                console.error('Data sync failed:', e.message);
                showPopup('error', 'Failed to load data: ' + e.message);
            }
        }

        async function openCamera() {
            const modal = document.getElementById('cameraModal');
            const video = document.getElementById('cameraVideo');
            const loading = document.getElementById('cameraLoading');
            modal.classList.remove('hidden'); loading.style.display = 'block'; video.style.display = 'none';
            try {
                videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                video.srcObject = videoStream;
                video.onloadedmetadata = () => { loading.style.display = 'none'; video.style.display = 'block'; video.play(); };
            } catch (err) {
                console.error("Camera access error:", err); showPopup('error', 'Cannot access camera. Please check permissions.'); closeCamera();
            }
        }

        function closeCamera() {
            const modal = document.getElementById('cameraModal'); modal.classList.add('hidden');
            if (videoStream) { videoStream.getTracks().forEach(track => track.stop()); videoStream = null; }
        }

        function takePhoto() {
            const video = document.getElementById('cameraVideo'); const canvas = document.getElementById('cameraCanvas');
            if (!videoStream) return;
            canvas.width = video.videoWidth; canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d'); ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
                capturedImageBlob = blob; document.getElementById('previewImg').src = URL.createObjectURL(blob);
                document.getElementById('imagePreview').classList.remove('hidden'); document.getElementById('problemImage').value = '';
                closeCamera(); showPopup('success', 'Photo captured successfully.');
            }, 'image/jpeg', 0.8);
        }

        function renderStatusChart(canvasId, statsData, isOfficial = false) {
            const ctx = document.getElementById(canvasId).getContext('2d');
            if (isOfficial && officialChartInstance) officialChartInstance.destroy();
            else if (!isOfficial && citizenChartInstance) citizenChartInstance.destroy();
            if (statsData.reduce((a, b) => a + b, 0) === 0) statsData = [0, 0, 1];
            const chartConfig = { type: 'doughnut', data: { labels: ['Pending', 'In Progress', 'Resolved'], datasets: [{ data: statsData, backgroundColor: ['#fbbf24', '#3b82f6', '#10b981'], borderWidth: 0 }] }, options: { responsive: true, cutout: '75%', plugins: { legend: { position: 'bottom' } } } };
            if (isOfficial) officialChartInstance = new Chart(ctx, chartConfig); else citizenChartInstance = new Chart(ctx, chartConfig);
        }

        function showPopup(type, message) {
            const container = document.getElementById('popupContainer'); const popup = document.createElement('div');
            let bgColor;
            if (type === 'success') bgColor = 'bg-emerald-50 border-emerald-500 text-emerald-800';
            else if (type === 'error') bgColor = 'bg-red-50 border-red-500 text-red-800';
            else if (type === 'warning') bgColor = 'bg-amber-50 border-amber-500 text-amber-800';
            else bgColor = 'bg-blue-50 border-blue-500 text-blue-800';
            popup.className = `${bgColor} border-l-4 p-4 rounded-r-lg shadow-lg max-w-sm transform transition-all duration-300 ease-out translate-x-full`;
            popup.innerHTML = `<div class="flex items-start"><div class="flex-1"><p class="text-sm font-semibold">${message}</p></div></div>`;
            container.appendChild(popup);
            setTimeout(() => popup.classList.remove('translate-x-full'), 50);
            setTimeout(() => { if (popup.parentElement) { popup.classList.add('translate-x-full'); setTimeout(() => popup.remove(), 300); } }, 3000);
        }

        function displaySampleMessage() { console.log('DB driven now.'); }
        function initializeSampleData() { displaySampleMessage(); }

        function hideAllSections() { ['userTypeSelection', 'citizenLogin', 'officialLogin', 'adminLogin', 'citizenDashboard', 'officialDashboard', 'adminDashboard'].forEach(id => document.getElementById(id).classList.add('hidden')); }
        function showUserTypeSelection() { hideAllSections(); document.getElementById('userTypeSelection').classList.remove('hidden'); }
        function showLogin(type) { hideAllSections(); document.getElementById(type + 'Login').classList.remove('hidden'); }
        function showCitizenTab(tab) {
            document.getElementById('citizenLoginForm').classList.toggle('hidden', tab !== 'login');
            document.getElementById('citizenSignupForm').classList.toggle('hidden', tab === 'login');
            updateTabStyles('citizenLoginTab', 'citizenSignupTab', tab === 'login', 'blue');
        }
        function showOfficialTab(tab) {
            document.getElementById('officialLoginForm').classList.toggle('hidden', tab !== 'login');
            document.getElementById('officialSignupForm').classList.toggle('hidden', tab === 'login');
            updateTabStyles('loginTab', 'signupTab', tab === 'login', 'emerald');
        }
        function updateTabStyles(loginId, signupId, isLogin, color) {
            const lTab = document.getElementById(loginId); const sTab = document.getElementById(signupId);
            const activeClasses = ['bg-white', `text-${color}-600`, 'shadow', 'scale-105'];
            const inactiveClasses = ['text-slate-500', 'hover:text-slate-800', 'hover:bg-slate-200/50'];
            if(isLogin) {
                lTab.classList.add(...activeClasses); lTab.classList.remove(...inactiveClasses);
                sTab.classList.add(...inactiveClasses); sTab.classList.remove(...activeClasses);
            } else {
                sTab.classList.add(...activeClasses); sTab.classList.remove(...inactiveClasses);
                lTab.classList.add(...inactiveClasses); lTab.classList.remove(...activeClasses);
            }
        }
        async function showCitizenSection(section) {
            document.getElementById('citizenProblemUpload').classList.toggle('hidden', section === 'profile');
            document.getElementById('citizenProfile').classList.toggle('hidden', section !== 'profile');
            await syncData();
            if (section === 'profile') loadCitizenProfile(); else loadCitizenProblems();
        }
        async function showOfficialSection(section) {
            document.getElementById('officialProblems').classList.toggle('hidden', section === 'profile');
            document.getElementById('officialProfile').classList.toggle('hidden', section !== 'profile');
            await syncData();
            if (section === 'profile') loadOfficialProfile(); else loadOfficialProblems();
        }

        // Registration flow
        async function handleDirectSignup(payload) {
            try {
                await apiFetch('/auth/register', 'POST', payload);
                showPopup('success', 'Registration successful! Please login.');
                if (payload.type === 'citizen') showCitizenTab('login');
                else showOfficialTab('login');
            } catch (e) { showPopup('error', e.message); }
        }

        async function citizenLogin(e) {
            e.preventDefault();
            const username = document.getElementById('citizenUsername').value, pass = document.getElementById('citizenPassword').value;
            try {
                const res = await apiFetch('/auth/login', 'POST', { type: 'citizen', username, password: pass });
                apiToken = res.token; currentUser = res.user; currentUserType = 'citizen';
                document.getElementById('citizenHeaderName').textContent = currentUser.name;
                hideAllSections(); document.getElementById('citizenDashboard').classList.remove('hidden');
                await syncData(); loadCitizenProblems(); showPopup('success', 'Logged in');
            } catch (e) { showPopup('error', e.message); }
        }

        function citizenSignup(e) {
            e.preventDefault();
            const payload = {
                type: 'citizen', name: document.getElementById('citizenName').value, mobile: document.getElementById('citizenMobile').value,
                email: document.getElementById('citizenEmail').value, password: document.getElementById('citizenNewPassword').value,
                address: document.getElementById('citizenAddress').value
            };
            handleDirectSignup(payload);
        }

        async function officialLogin(e) {
            e.preventDefault();
            const username = document.getElementById('officialDeptId').value, pass = document.getElementById('officialPassword').value;
            try {
                const res = await apiFetch('/auth/login', 'POST', { type: 'official', username, password: pass });
                apiToken = res.token; currentUser = res.user; currentUserType = 'official';
                document.getElementById('officialHeaderDept').textContent = getDepartmentName(currentUser.department) + ' Portal';
                hideAllSections(); document.getElementById('officialDashboard').classList.remove('hidden');
                await syncData(); loadOfficialProblems(); showPopup('success', 'Logged in');
            } catch (e) { showPopup('error', e.message); }
        }

        function officialSignup(e) {
            e.preventDefault();
            const payload = {
                type: 'official', name: document.getElementById('officialName').value, mobile: document.getElementById('officialMobile').value,
                department: document.getElementById('officialDepartment').value, departmentId: document.getElementById('officialNewDeptId').value,
                username: document.getElementById('officialUsername').value, password: document.getElementById('officialNewPassword').value
            };
            handleDirectSignup(payload);
        }

        async function adminLogin(e) {
            e.preventDefault();
            const username = document.getElementById('adminUsername').value, pass = document.getElementById('adminPassword').value;
            try {
                const res = await apiFetch('/auth/login', 'POST', { type: 'admin', username, password: pass });
                apiToken = res.token; currentUser = res.user; currentUserType = 'admin';
                hideAllSections(); document.getElementById('adminDashboard').classList.remove('hidden');
                await showAdminSection('overview'); showPopup('success', 'Admin Logged In');
            } catch (e) { showPopup('error', e.message); }
        }
        function logout() { currentUser = null; currentUserType = null; apiToken = null; problems = []; citizens = []; officials = []; showUserTypeSelection(); }

        function getBase64(file) { return new Promise((res, rej) => { const r = new FileReader(); r.readAsDataURL(file); r.onload = () => res(r.result); r.onerror = e => rej(e); }); }

        // ── Map Picker (Leaflet + OpenStreetMap + Nominatim — 100% free) ────
        let mapPickerInstance = null;
        let mapPickerMarker = null;
        let mapPickerLatLng = null;
        let mapPickerAddress = '';

        function openMapPicker() {
            document.getElementById('mapPickerModal').classList.remove('hidden');
            setTimeout(initLeafletMap, 200); // wait for modal to render
        }

        function closeMapPicker() {
            document.getElementById('mapPickerModal').classList.add('hidden');
        }

        function initLeafletMap() {
            const mapDiv = document.getElementById('googleMap');
            document.getElementById('mapLoading').classList.add('hidden');

            if (!mapPickerInstance) {
                // Default center: Salem, Tamil Nadu
                mapPickerInstance = L.map(mapDiv, { zoomControl: true }).setView([11.6643, 78.1460], 14);

                // OpenStreetMap tiles — completely free
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                    maxZoom: 19
                }).addTo(mapPickerInstance);

                // Click anywhere on map to place pin
                mapPickerInstance.on('click', (e) => placeLeafletMarker(e.latlng));
            } else {
                // Force Leaflet to re-calculate map size (needed after modal show)
                mapPickerInstance.invalidateSize();
            }

            // Auto-pan to user's GPS position
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => mapPickerInstance.panTo([pos.coords.latitude, pos.coords.longitude]),
                    () => { } // silent — keep default center
                );
            }
        }

        function centreOnMe() {
            if (!mapPickerInstance) return;
            if (!navigator.geolocation) return showPopup('error', 'Geolocation not supported.');
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const ll = [pos.coords.latitude, pos.coords.longitude];
                    mapPickerInstance.setView(ll, 16);
                    placeLeafletMarker({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                },
                () => showPopup('error', 'Location access denied.')
            );
        }

        async function placeLeafletMarker(latlng) {
            mapPickerLatLng = latlng;

            if (!mapPickerMarker) {
                mapPickerMarker = L.marker([latlng.lat, latlng.lng], {
                    draggable: true
                }).addTo(mapPickerInstance);

                // Allow dragging the pin to fine-tune position
                mapPickerMarker.on('dragend', (e) => {
                    const pos = e.target.getLatLng();
                    placeLeafletMarker({ lat: pos.lat, lng: pos.lng });
                });
            } else {
                mapPickerMarker.setLatLng([latlng.lat, latlng.lng]);
            }

            document.getElementById('mapSelectedAddress').textContent = 'Fetching address…';
            document.getElementById('confirmLocationBtn').disabled = true;

            // Reverse geocode using Nominatim (OpenStreetMap) — no API key needed
            try {
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?lat=${latlng.lat}&lon=${latlng.lng}&format=json`,
                    { headers: { 'Accept-Language': 'en' } }
                );
                const data = await res.json();
                mapPickerAddress = data.display_name || `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
            } catch {
                mapPickerAddress = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
            }

            document.getElementById('mapSelectedAddress').textContent = mapPickerAddress;
            document.getElementById('confirmLocationBtn').disabled = false;
        }

        function confirmMapLocation() {
            if (!mapPickerLatLng) return;
            document.getElementById('problemLocation').value = mapPickerAddress;
            closeMapPicker();
            showPopup('success', 'Location pinned successfully!');
        }

        // Removed actual functionality from update profile to preserve original UI without making breaking changes to missing endpoints
        function updateCitizenProfile(e) { e.preventDefault(); showPopup('warning', 'Profile update not implemented in DB version yet.'); }
        function updateOfficialProfile(e) { e.preventDefault(); showPopup('warning', 'Profile update not implemented in DB version yet.'); }

        async function submitProblem(e) {
            e.preventDefault();
            const imgFile = document.getElementById('problemImage').files[0];
            const hasImage = imgFile || capturedImageBlob;
            
            // Generate form data for multer upload instead of base64
            const formData = new FormData();
            formData.append('department', document.getElementById('problemDepartment').value);
            formData.append('priority', document.getElementById('problemPriority').value);
            formData.append('description', document.getElementById('problemDescription').value);
            formData.append('location', document.getElementById('problemLocation').value);
            if (imgFile) formData.append('image', imgFile);
            else if (capturedImageBlob) formData.append('image', capturedImageBlob, 'capture.jpg');
            
            try {
                const headers = {};
                if (apiToken) headers['Authorization'] = 'Bearer ' + apiToken;
                const res = await fetch(API_BASE + '/problems', { method: 'POST', headers, body: formData });
                if (!res.ok) { let err; try { err = (await res.json()).error; } catch (e) { err = res.statusText; } throw new Error(err); }
                showPopup('success', 'Ticket Submitted'); e.target.reset(); clearImage(); await syncData(); loadCitizenProblems();
            } catch (err) { showPopup('error', err.message); }
        }

        function getDepartmentName(dept) { const d = { 'water': 'Water & Sanitation', 'roads': 'Roads & Infrastructure', 'electricity': 'Electricity', 'waste': 'Waste Management', 'parks': 'Parks & Recreation', 'health': 'Public Health', 'drainage': 'Drainage & Sewage', 'transport': 'Public Transport', 'fire': 'Fire & Emergency', 'building': 'Building & Planning' }; return d[dept] || dept; }

        function renderProblemCard(problem, role = 'citizen') {
            const isOfficial = role === 'official', isAdmin = role === 'admin';
            const colors = { pending: 'bg-yellow-100 text-yellow-800', progress: 'bg-blue-100 text-blue-800', completed: 'bg-emerald-100 text-emerald-800', closed: 'bg-slate-200 text-slate-800', low: 'text-slate-500', medium: 'text-amber-600', high: 'text-orange-600', urgent: 'text-red-600 font-bold' };
            const proofHtml = problem.proof_image ? `<div class="mt-3 mb-3 rounded-xl overflow-hidden border-2 border-emerald-200 relative"><div class="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 absolute top-0 left-0 rounded-br-lg">Official Proof</div><img src="${problem.proof_image}" class="w-full h-32 object-cover"></div>` : '';
            let feedbackHtml = '';
            if (problem.feedback) feedbackHtml = `<div class="mt-3 p-3 bg-purple-50 rounded-xl border border-purple-100"><p class="text-xs font-bold text-purple-800 mb-1">Citizen Feedback:</p><p class="text-sm italic">"${problem.feedback}"</p></div>`;
            else if (role === 'citizen' && problem.status === 'completed') feedbackHtml = `<div class="mt-3 pt-3 border-t"><button onclick="openFeedbackModal('${problem.id}')" class="text-sm text-blue-600 font-bold hover:underline">Leave Feedback for Admin</button></div>`;
            let adminActionHtml = '';
            if (isAdmin && problem.feedback) adminActionHtml = `<div class="mt-4 pt-3 border-t flex space-x-2"><button onclick="approveAndClose('${problem.id}')" class="flex-1 bg-emerald-600 text-white font-bold py-2 rounded-lg hover:bg-emerald-700 transition shadow-sm text-sm">Approve & Close</button><button onclick="reassignToOfficial('${problem.id}')" class="flex-1 bg-amber-500 text-white font-bold py-2 rounded-lg hover:bg-amber-600 transition shadow-sm text-sm">Reassign</button></div>`;
            return `
                <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col h-full">
                    <div class="flex justify-between items-start mb-3">
                        <span class="font-mono text-sm font-bold text-slate-500">${problem.id}</span>
                        <div class="flex space-x-2">
                            <span class="px-2 py-1 rounded-md text-xs font-bold ${colors[problem.status]} uppercase">${problem.status}</span>
                            ${isOfficial && problem.status !== 'completed' && problem.status !== 'closed' ? `<button onclick="openStatusUpdate('${problem.id}')" class="bg-emerald-500 text-white p-1 rounded hover:bg-emerald-600">Update</button>` : ''}
                        </div>
                    </div>
                    ${problem.image_data ? `<img src="${problem.image_data}" class="w-full h-32 object-cover rounded-lg mb-3">` : ''}
                    ${proofHtml}
                    <div class="mb-3"><span class="text-sm font-bold">${getDepartmentName(problem.department)}</span> <span class="text-xs float-right ${colors[problem.priority]} uppercase">${problem.priority}</span></div>
                    <div class="flex-grow space-y-1"><p class="text-sm text-slate-600">📍 ${problem.location}</p><p class="text-sm text-slate-500 line-clamp-2">${problem.description}</p></div>
                    ${feedbackHtml}
                    ${adminActionHtml}
                </div>`;
        }

        function openFeedbackModal(id) { document.getElementById('feedbackProblemId').value = id; document.getElementById('feedbackModal').classList.remove('hidden'); }
        function closeFeedbackModal() { document.getElementById('feedbackModal').classList.add('hidden'); }
        async function submitFeedback(e) {
            e.preventDefault(); const id = document.getElementById('feedbackProblemId').value; const feedback = document.getElementById('feedbackText').value;
            try { await apiFetch(`/problems/${id}/feedback`, 'PUT', { feedback }); closeFeedbackModal(); showPopup('success', 'Sent to Admin'); await syncData(); loadCitizenProblems(); loadCitizenProfile(); } catch (e) { showPopup('error', e.message); }
        }

        function loadCitizenProblems() { 
            const list = problems.filter(p => p.citizen_id === currentUser.id); 
            const container = document.getElementById('citizenProblems');
            if(list.length === 0) {
                container.innerHTML = `<div class="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200"><p class="text-slate-500 font-medium">No recent tickets found.</p></div>`;
            } else {
                container.innerHTML = list.slice(0, 3).map(p => renderProblemCard(p, 'citizen')).join(''); 
            }
        }
        function loadCitizenProfile() {
            document.getElementById('editCitName').value = currentUser.name; document.getElementById('editCitEmail').value = currentUser.email; document.getElementById('editCitMobile').value = currentUser.mobile; document.getElementById('editCitAddress').value = currentUser.address;
            const myProbs = problems.filter(p => p.citizen_id === currentUser.id);
            const pen = myProbs.filter(p => p.status === 'pending').length, prog = myProbs.filter(p => p.status === 'progress').length, comp = myProbs.filter(p => p.status === 'completed' || p.status === 'closed').length;
            document.getElementById('totalReports').textContent = myProbs.length; document.getElementById('progressReports').textContent = prog; document.getElementById('completedReports').textContent = comp;
            renderStatusChart('citizenStatsChart', [pen, prog, comp], false);
            const container = document.getElementById('allCitizenProblems');
            if(myProbs.length === 0) {
                container.innerHTML = `<div class="p-12 text-center col-span-full bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200"><p class="text-slate-500 font-medium text-lg">You haven't submitted any tickets yet.</p></div>`;
            } else {
                container.innerHTML = myProbs.map(p => renderProblemCard(p, 'citizen')).join('');
            }
        }

        let currentFilter = 'all';
        function filterOfficialProblems(f) { 
            currentFilter = f || currentFilter; 
            const tabs = ['all', 'pending', 'progress', 'completed'];
            tabs.forEach(t => {
                const el = document.getElementById(t === 'all' ? 'allProblemsTab' : t + 'ProblemsTab');
                if(!el) return;
                if(t === currentFilter) {
                    el.classList.add('bg-white', 'text-slate-800', 'shadow');
                    el.classList.remove('text-slate-500', 'hover:text-slate-800', 'hover:bg-slate-200/50');
                } else {
                    el.classList.remove('bg-white', 'text-slate-800', 'shadow');
                    el.classList.add('text-slate-500', 'hover:text-slate-800', 'hover:bg-slate-200/50');
                }
            });
            loadOfficialProblems(); 
        }
        function loadOfficialProblems() {
            let list = problems.filter(p => p.assigned_to === currentUser.id || p.department === currentUser.department);
            if (currentFilter !== 'all') list = list.filter(p => p.status === currentFilter);
            const container = document.getElementById('officialProblemsList');
            if (list.length === 0) {
                container.innerHTML = `<div class="p-16 text-center col-span-full bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200/60 shadow-inner"><p class="text-slate-500 font-bold text-lg">No tickets found in this section.</p><p class="text-sm text-slate-400 mt-2">Try changing your filter settings to see more results.</p></div>`;
            } else {
                container.innerHTML = list.map(p => renderProblemCard(p, 'official')).join('');
            }
        }
        function loadOfficialProfile() {
            document.getElementById('editOffName').value = currentUser.name; document.getElementById('editOffUsername').value = currentUser.username; document.getElementById('editOffMobile').value = currentUser.mobile;
            const myProbs = problems.filter(p => p.assigned_to === currentUser.id || p.department === currentUser.department);
            const pen = myProbs.filter(p => p.status === 'pending').length, prog = myProbs.filter(p => p.status === 'progress').length, comp = myProbs.filter(p => p.status === 'completed' || p.status === 'closed').length;
            document.getElementById('totalAssigned').textContent = myProbs.length; document.getElementById('totalInProgress').textContent = prog; document.getElementById('totalSolved').textContent = comp; document.getElementById('successRate').textContent = myProbs.length ? Math.round((comp / myProbs.length) * 100) + '%' : '0%';
            renderStatusChart('officialStatsChart', [pen, prog, comp], true);
        }

        function openStatusUpdate(id) { document.getElementById('updateProblemId').value = id; document.getElementById('statusUpdateModal').classList.remove('hidden'); }
        document.getElementById('newStatus').addEventListener('change', e => document.getElementById('proofUploadSection').classList.toggle('hidden', e.target.value !== 'completed'));
        function closeStatusUpdate() { document.getElementById('statusUpdateModal').classList.add('hidden'); }
        async function updateProblemStatus(e) {
            e.preventDefault(); const id = document.getElementById('updateProblemId').value, status = document.getElementById('newStatus').value, proofFile = document.getElementById('proofImage').files[0];
            if (status === 'completed' && !proofFile) return showPopup('warning', 'Proof required');
            
            // Use formData to support image file uploads
            const formData = new FormData();
            formData.append('status', status);
            if (proofFile) formData.append('proofImage', proofFile);
            
            try { 
                const headers = {};
                if (apiToken) headers['Authorization'] = 'Bearer ' + apiToken;
                await fetch(API_BASE + `/problems/${id}/status`, { method: 'PUT', headers, body: formData });
                closeStatusUpdate(); await syncData(); loadOfficialProblems(); showPopup('success', 'Updated'); 
            } catch (err) { showPopup('error', err.message); }
        }

        async function showAdminSection(section) {
            ['adminOverview', 'adminUsers', 'adminOfficials', 'adminFeedbacks'].forEach(id => document.getElementById(id).classList.add('hidden'));
            document.getElementById('admin' + section.charAt(0).toUpperCase() + section.slice(1)).classList.remove('hidden');
            await syncData();
            if (section === 'overview') loadAdminOverview(); else if (section === 'users') loadAdminUsers(); else if (section === 'officials') loadAdminOfficials(); else if (section === 'feedbacks') loadAdminFeedbacks();
        }
        function loadAdminOverview() {
            document.getElementById('adminStatCitizens').innerText = citizens.length; document.getElementById('adminStatOfficials').innerText = officials.length;
            document.getElementById('adminStatTickets').innerText = problems.filter(p => p.status !== 'closed').length; document.getElementById('adminStatFeedbacks').innerText = problems.filter(p => p.feedback && p.status === 'completed').length;
        }
        function loadAdminUsers() { document.getElementById('adminCitizensList').innerHTML = citizens.map(c => `<tr><td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${c.id}</td><td class="px-6 py-4 whitespace-nowrap text-sm font-medium">${c.name}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${c.email}</td><td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><button onclick="deleteUser('citizen', '${c.id}')" class="text-red-600 hover:text-red-900">Delete</button></td></tr>`).join(''); }
        function loadAdminOfficials() { document.getElementById('adminOfficialsList').innerHTML = officials.map(o => `<tr><td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${o.id}</td><td class="px-6 py-4 whitespace-nowrap text-sm font-medium">${o.name}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${getDepartmentName(o.department)}</td><td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><button onclick="deleteUser('official', '${o.id}')" class="text-red-600 hover:text-red-900">Delete</button></td></tr>`).join(''); }
        async function deleteUser(type, id) { try { await apiFetch(`/users/${type}/${id}`, 'DELETE'); showPopup('success', type + ' deleted'); await showAdminSection(type === 'citizen' ? 'users' : 'officials'); } catch (e) { showPopup('error', e.message); } }

        function loadAdminFeedbacks() { const list = problems.filter(p => p.feedback && p.status === 'completed'); document.getElementById('adminFeedbackList').innerHTML = list.length ? list.map(p => renderProblemCard(p, 'admin')).join('') : '<p class="text-slate-500 col-span-2">No pending feedbacks to review.</p>'; }
        async function approveAndClose(id) { try { await apiFetch(`/problems/${id}/admin-action`, 'PUT', { status: 'closed', feedbackAppend: ' [Admin: Approved & Closed]' }); showPopup('success', 'Closed'); await showAdminSection('feedbacks'); } catch (e) { showPopup('error', e.message); } }
        async function reassignToOfficial(id) { try { await apiFetch(`/problems/${id}/admin-action`, 'PUT', { status: 'progress', feedbackAppend: ' [Admin: Re-evaluate]', clearProof: true }); showPopup('success', 'Reassigned'); await showAdminSection('feedbacks'); } catch (e) { showPopup('error', e.message); } }

        document.getElementById('problemImage').addEventListener('change', function (e) { if (e.target.files[0]) { document.getElementById('previewImg').src = URL.createObjectURL(e.target.files[0]); document.getElementById('imagePreview').classList.remove('hidden'); capturedImageBlob = null; } });
        function clearImage() { capturedImageBlob = null; document.getElementById('problemImage').value = ''; document.getElementById('imagePreview').classList.add('hidden'); }
        document.getElementById('proofImage').addEventListener('change', function (e) { if (e.target.files[0]) { document.getElementById('proofPreviewImg').src = URL.createObjectURL(e.target.files[0]); document.getElementById('proofImagePreview').classList.remove('hidden'); } });
        function clearProofImage() { document.getElementById('proofImage').value = ''; document.getElementById('proofImagePreview').classList.add('hidden'); }

        document.addEventListener('DOMContentLoaded', () => { initializeSampleData(); showUserTypeSelection(); });
