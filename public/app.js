        let apiToken = null;
        let currentUser = null;
        let currentUserType = null;
        let problems = [];
        let citizens = [];
        let officials = [];
        let capturedImageBlob = null;
        let citizenChartInstance = null;
        let officialChartInstance = null;
        let adminDeptChartInstance = null;
        let adminStatusChartInstance = null;
        let videoStream = null;
        let pendingAuthData = null;
        let satisfactionProblemId = null;
        let selectedRatingValue = 0;
        let currentCitizenHistoryFilter = 'all';

        const SERVER_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
        const API_BASE = SERVER_BASE + '/api';

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

        let cameraContext = 'problem';
        let capturedProofBlob = null;

        async function openCamera(context = 'problem') {
            cameraContext = context;
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
                if (cameraContext === 'problem') {
                    capturedImageBlob = blob; document.getElementById('previewImg').src = URL.createObjectURL(blob);
                    document.getElementById('imagePreview').classList.remove('hidden'); document.getElementById('problemImage').value = '';
                } else {
                    capturedProofBlob = blob; document.getElementById('proofPreviewImg').src = URL.createObjectURL(blob);
                    document.getElementById('proofImagePreview').classList.remove('hidden'); document.getElementById('proofImage').value = '';
                }
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
                startNotificationPolling();
            } catch (e) { showPopup('error', e.message); }
        }

        async function sendCitizenOTP() {
            const name = document.getElementById('citizenName').value;
            const mobile = document.getElementById('citizenMobile').value;
            const email = document.getElementById('citizenEmail').value;
            const password = document.getElementById('citizenNewPassword').value;
            const address = document.getElementById('citizenAddress').value;

            if (!name || !mobile || !email || !password || !address) {
                return showPopup('error', 'Please fill all required fields');
            }

            const btn = document.getElementById('btnSendOTP');
            btn.innerHTML = '<span class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span> <span>Sending OTP...</span>';
            btn.disabled = true;

            try {
                const res = await fetch('/api/auth/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                
                if (res.ok) {
                    showPopup('success', 'Verification code sent to your email');
                    document.getElementById('displayOtpEmail').innerText = email;
                    document.getElementById('citizenSignupStep1').classList.add('hidden');
                    document.getElementById('citizenSignupStep2').classList.remove('hidden');
                } else {
                    showPopup('error', data.error);
                }
            } catch (err) {
                showPopup('error', 'Network error. Try again.');
            } finally {
                btn.innerHTML = '<span>Send Verification OTP</span>';
                btn.disabled = false;
            }
        }

        function backToSignupStep1() {
            document.getElementById('citizenSignupStep2').classList.add('hidden');
            document.getElementById('citizenSignupStep1').classList.remove('hidden');
        }

        async function citizenSignupSubmit() {
            const name = document.getElementById('citizenName').value;
            const mobile = document.getElementById('citizenMobile').value;
            const email = document.getElementById('citizenEmail').value;
            const password = document.getElementById('citizenNewPassword').value;
            const address = document.getElementById('citizenAddress').value;
            const otp = document.getElementById('citizenOtp').value;

            if (!otp) return showPopup('error', 'Please enter the verification code');

            const btn = document.getElementById('btnVerifyOTP');
            btn.innerHTML = '<span class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span> <span>Verifying...</span>';
            btn.disabled = true;

            try {
                const payload = { type: 'citizen', name, mobile, address, email, password, otp };
                const res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (res.ok) {
                    showPopup('success', 'Registration successful! Please login.');
                    showCitizenTab('login');
                    document.getElementById('citizenName').value = '';
                    document.getElementById('citizenMobile').value = '';
                    document.getElementById('citizenEmail').value = '';
                    document.getElementById('citizenNewPassword').value = '';
                    document.getElementById('citizenAddress').value = '';
                    document.getElementById('citizenOtp').value = '';
                    backToSignupStep1();
                } else {
                    showPopup('error', data.error);
                }
            } catch (err) {
                showPopup('error', 'Registration failed. Try again.');
            } finally {
                btn.innerHTML = '<span>Verify & Create Account</span>';
                btn.disabled = false;
            }
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
                startOfficialNotificationPolling();
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
        function logout() {
            stopNotificationPolling();
            stopOfficialNotificationPolling();
            currentUser = null; currentUserType = null; apiToken = null;
            problems = []; citizens = []; officials = [];
            lastKnownStatuses = {}; offLastKnownStatuses = {};
            showUserTypeSelection();
        }

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
        async function updateCitizenProfile(e) {
            e.preventDefault();
            const name     = document.getElementById('editCitName').value;
            const mobile   = document.getElementById('editCitMobile').value;
            const address  = document.getElementById('editCitAddress').value;
            const password = document.getElementById('editCitPassword').value;
            try {
                const res = await apiFetch('/users/citizen/profile', 'PUT', { name, mobile, address, password: password || undefined });
                // Update local state so header name reflects immediately
                currentUser = { ...currentUser, ...res.user };
                document.getElementById('citizenHeaderName').textContent = currentUser.name;
                showPopup('success', '✅ Profile updated successfully!');
            } catch (e) { showPopup('error', e.message); }
        }
        async function updateOfficialProfile(e) {
            e.preventDefault();
            const name     = document.getElementById('editOffName').value;
            const mobile   = document.getElementById('editOffMobile').value;
            const password = document.getElementById('editOffPassword').value;
            try {
                const res = await apiFetch('/users/official/profile', 'PUT', { name, mobile, password: password || undefined });
                currentUser = { ...currentUser, ...res.user };
                document.getElementById('officialHeaderDept').textContent = getDepartmentName(currentUser.department) + ' Portal';
                showPopup('success', '✅ Profile updated successfully!');
            } catch (e) { showPopup('error', e.message); }
        }

        async function submitProblem(e) {
            e.preventDefault();
            const imgFile = document.getElementById('problemImage').files[0];
            const formData = new FormData();
            formData.append('department', document.getElementById('problemDepartment').value);
            formData.append('priority', document.getElementById('problemPriority').value);
            formData.append('description', document.getElementById('problemDescription').value);
            formData.append('location', document.getElementById('problemLocation').value);
            if (mapPickerLatLng) {
                formData.append('lat', mapPickerLatLng.lat);
                formData.append('lng', mapPickerLatLng.lng);
            }
            if (imgFile) formData.append('image', imgFile);
            else if (capturedImageBlob) formData.append('image', capturedImageBlob, 'capture.jpg');
            try {
                const headers = {};
                if (apiToken) headers['Authorization'] = 'Bearer ' + apiToken;
                const res = await fetch(API_BASE + '/problems', { method: 'POST', headers, body: formData });
                if (!res.ok) { let err; try { err = (await res.json()).error; } catch (e) { err = res.statusText; } throw new Error(err); }
                showPopup('success', '✅ Ticket Submitted Successfully!');
                e.target.reset(); clearImage(); mapPickerLatLng = null;
                await syncData(); loadCitizenProblems(); updateNotificationSnapshot();
            } catch (err) { showPopup('error', err.message); }
        }

        function getDepartmentName(dept) { const d = { 'water': 'Water & Sanitation', 'roads': 'Roads & Infrastructure', 'electricity': 'Electricity', 'waste': 'Waste Management', 'parks': 'Parks & Recreation', 'health': 'Public Health', 'drainage': 'Drainage & Sewage', 'transport': 'Public Transport', 'fire': 'Fire & Emergency', 'building': 'Building & Planning' }; return d[dept] || dept; }

        function renderProblemCard(problem, role = 'citizen') {
            const isOfficial = role === 'official', isAdmin = role === 'admin';
            const colors = { pending: 'bg-yellow-100 text-yellow-800', progress: 'bg-blue-100 text-blue-800', completed: 'bg-emerald-100 text-emerald-800', closed: 'bg-slate-200 text-slate-800', low: 'text-slate-500', medium: 'text-amber-600', high: 'text-orange-600', urgent: 'text-red-600 font-bold' };
            
            let imgUrl = problem.image_data;
            if (imgUrl && imgUrl.startsWith('/')) imgUrl = SERVER_BASE + imgUrl;
            let proofUrlStr = problem.proof_image;
            if (proofUrlStr && proofUrlStr.startsWith('/')) proofUrlStr = SERVER_BASE + proofUrlStr;

            const proofHtml = proofUrlStr ? `<div class="mt-3 mb-3 rounded-xl overflow-hidden border-2 border-emerald-200 relative"><div class="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 absolute top-0 left-0 rounded-br-lg">Official Proof</div><img src="${proofUrlStr}" class="w-full h-32 object-cover"></div>` : '';
            const ratingHtml = problem.rating ? `<div class="flex items-center space-x-1 mt-1">${'⭐'.repeat(problem.rating)}${'☆'.repeat(5 - problem.rating)} <span class="text-xs text-slate-400 ml-1">${problem.rating}/5</span></div>` : '';
            const dateStr = problem.date_reported ? new Date(problem.date_reported).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
            const isOverdue = problem.status === 'pending' && (Date.now() - new Date(problem.date_reported)) > 7 * 24 * 60 * 60 * 1000;
            const overdueBadge = isOverdue ? `<span class="ml-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full border border-red-200 animate-pulse">⏰ Overdue</span>` : '';
            const printBtn = role === 'citizen' ? `<button onclick="printTicket('${problem.id}')" title="Print Ticket" class="text-slate-400 hover:text-blue-600 transition p-1 rounded">🖨️</button>` : '';
            const deleteBtn = (role === 'citizen' || role === 'admin') ? `<button onclick="deleteProblem('${problem.id}')" title="Delete Ticket" class="text-red-400 hover:text-red-600 transition p-1 rounded">🗑️</button>` : '';
            let feedbackHtml = '';
            
            const lastFeedbackIndex = problem.feedback ? problem.feedback.lastIndexOf('[Citizen]:') : -1;
            const lastAdminIndex = problem.feedback ? problem.feedback.lastIndexOf('[Admin: Re-evaluate]') : -1;
            const needsCitizenConfirmation = problem.status === 'completed' && (!problem.feedback || lastAdminIndex > lastFeedbackIndex);
            const canRateExperience = problem.status === 'closed' && !problem.rating;

            if (problem.feedback) {
                feedbackHtml += `<div class="mt-3 p-3 bg-purple-50 rounded-xl border border-purple-100"><p class="text-xs font-bold text-purple-800 mb-1">Feedback History:</p><p class="text-sm italic whitespace-pre-wrap">${problem.feedback}</p></div>`;
            }

            if (role === 'citizen') {
                if (needsCitizenConfirmation) {
                    feedbackHtml += `<div class="mt-3 pt-3 border-t"><button onclick="openFeedbackModal('${problem.id}')" class="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-2 rounded-lg transition border border-blue-200">Confirm Resolution & Leave Comment</button></div>`;
                }
                if (canRateExperience) {
                    feedbackHtml += `<div class="mt-3 pt-3 border-t"><button onclick="openRatingModal('${problem.id}')" class="w-full bg-yellow-50 hover:bg-yellow-100 text-yellow-700 font-bold py-2 rounded-lg transition border border-yellow-200">⭐ Rate Your Experience</button></div>`;
                }
                if (problem.rating) {
                    feedbackHtml += `<div class="mt-3 p-2 bg-slate-50 rounded-lg text-sm font-bold text-slate-600 flex justify-between"><span>Experience Rating:</span> <span>${'⭐'.repeat(problem.rating)}</span></div>`;
                }
            }

            let adminActionHtml = '';
            if (isAdmin && problem.feedback) adminActionHtml = `<div class="mt-4 pt-3 border-t flex space-x-2"><button onclick="approveAndClose('${problem.id}')" class="flex-1 bg-emerald-600 text-white font-bold py-2 rounded-lg hover:bg-emerald-700 transition shadow-sm text-sm">Approve & Close</button><button onclick="reassignToOfficial('${problem.id}')" class="flex-1 bg-amber-500 text-white font-bold py-2 rounded-lg hover:bg-amber-600 transition shadow-sm text-sm">Reassign</button></div>`;
            return `
                <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col h-full">
                    <div class="flex justify-between items-center mb-3">
                        <div>
                            <div class="flex items-center flex-wrap gap-1">
                                <span class="font-mono text-sm font-bold text-slate-500">${problem.id}</span>${overdueBadge}
                            </div>
                            ${dateStr ? `<p class="text-xs text-slate-400 mt-0.5">📅 ${dateStr}</p>` : ''}
                        </div>
                        <div class="flex items-center space-x-1 flex-shrink-0">
                            <span class="px-2 py-1 rounded-md text-xs font-bold ${colors[problem.status]} uppercase">${problem.status}</span>
                            ${isOfficial && problem.status !== 'completed' && problem.status !== 'closed' ? `<button onclick="openStatusUpdate('${problem.id}')" class="bg-emerald-500 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-600 text-xs font-bold transition">Update</button>` : ''}
                            ${printBtn}
                            ${deleteBtn}
                        </div>
                    </div>
                    ${imgUrl ? `<img src="${imgUrl}" class="w-full h-32 object-cover rounded-lg mb-3">` : ''}
                    ${proofHtml}
                    <div class="mb-3"><span class="text-sm font-bold">${getDepartmentName(problem.department)}</span> <span class="text-xs float-right ${colors[problem.priority]} uppercase">${problem.priority}</span></div>
                    <div class="flex-grow space-y-1"><p class="text-sm text-slate-600">📍 ${problem.location}</p><p class="text-sm text-slate-500 line-clamp-2">${problem.description}</p></div>
                    ${feedbackHtml}
                    ${adminActionHtml}
                </div>`;
        }

        function openFeedbackModal(id) {
            document.getElementById('feedbackProblemId').value = id;
            document.getElementById('feedbackText').value = '';
            document.getElementById('feedbackModal').classList.remove('hidden');
        }
        function closeFeedbackModal() { document.getElementById('feedbackModal').classList.add('hidden'); }

        function openRatingModal(id) {
            document.getElementById('ratingProblemId').value = id;
            selectedRatingValue = 0;
            setRating(0);
            document.getElementById('ratingModal').classList.remove('hidden');
        }
        function closeRatingModal() { document.getElementById('ratingModal').classList.add('hidden'); }

        // ── Star Rating ──────────────────────────────────────────────────────
        const ratingLabels = ['', 'Poor 😞', 'Fair 😐', 'Good 🙂', 'Very Good 😊', 'Excellent 🌟'];
        function setRating(n) {
            selectedRatingValue = n;
            document.getElementById('selectedRating').value = n;
            for (let i = 1; i <= 5; i++) {
                const star = document.getElementById('star' + i);
                if (star) star.className = `text-4xl transition-all star-btn ${i <= n ? 'text-yellow-400 scale-110' : 'text-slate-300 hover:text-yellow-400'}`;
            }
            const lbl = document.getElementById('ratingLabel');
            if (lbl) lbl.textContent = n > 0 ? ratingLabels[n] : 'Click a star to rate';
        }

        async function submitFeedback(e) {
            e.preventDefault();
            const id = document.getElementById('feedbackProblemId').value;
            const feedback = document.getElementById('feedbackText').value;
            if (!feedback || feedback.trim().length === 0) return showPopup('warning', 'Please enter a comment.');
            try {
                await apiFetch(`/problems/${id}/feedback`, 'PUT', { feedback });
                closeFeedbackModal();
                showPopup('success', `Feedback submitted to Admin.`);
                await syncData(); loadCitizenProblems(); loadCitizenProfile();
            } catch (e) { showPopup('error', e.message); }
        }

        async function submitRating(e) {
            e.preventDefault();
            const id = document.getElementById('ratingProblemId').value;
            const rating = selectedRatingValue > 0 ? selectedRatingValue : undefined;
            if (!rating) return showPopup('warning', 'Please select a star rating.');
            try {
                await apiFetch(`/problems/${id}/feedback`, 'PUT', { rating });
                closeRatingModal();
                showPopup('success', `⭐ Thank you! Your ${selectedRatingValue}-star rating was submitted.`);
                await syncData(); loadCitizenProblems(); loadCitizenProfile();
            } catch (e) { showPopup('error', e.message); }
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
            document.getElementById('editCitName').value = currentUser.name;
            document.getElementById('editCitEmail').value = currentUser.email;
            document.getElementById('editCitMobile').value = currentUser.mobile;
            document.getElementById('editCitAddress').value = currentUser.address || '';
            const myProbs = problems.filter(p => p.citizen_id === currentUser.id);
            const pen = myProbs.filter(p => p.status === 'pending').length, prog = myProbs.filter(p => p.status === 'progress').length, comp = myProbs.filter(p => p.status === 'completed' || p.status === 'closed').length;
            document.getElementById('totalReports').textContent = myProbs.length;
            document.getElementById('progressReports').textContent = prog;
            document.getElementById('completedReports').textContent = comp;
            renderStatusChart('citizenStatsChart', [pen, prog, comp], false);
            filterCitizenHistory(currentCitizenHistoryFilter);
        }

        // ── Citizen history filter ────────────────────────────────────────────
        function filterCitizenHistory(filter) {
            currentCitizenHistoryFilter = filter;
            const tabs = ['all', 'pending', 'progress', 'completed', 'closed'];
            const idMap = { all: 'citHistAll', pending: 'citHistPending', progress: 'citHistProgress', completed: 'citHistCompleted', closed: 'citHistClosed' };
            tabs.forEach(t => {
                const el = document.getElementById(idMap[t]);
                if (!el) return;
                if (t === filter) {
                    el.className = 'px-3 py-1.5 rounded-lg font-bold bg-white text-blue-600 shadow transition-all';
                } else {
                    el.className = 'px-3 py-1.5 rounded-lg font-bold text-slate-500 hover:text-slate-800 transition-all';
                }
            });
            const myProbs = problems.filter(p => p.citizen_id === currentUser.id);
            const list = filter === 'all' ? myProbs : myProbs.filter(p => p.status === filter);
            const container = document.getElementById('allCitizenProblems');
            if (list.length === 0) {
                container.innerHTML = `<div class="p-12 text-center col-span-full bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200"><p class="text-slate-500 font-medium text-lg">No ${filter === 'all' ? '' : filter + ' '}tickets found.</p></div>`;
            } else {
                container.innerHTML = list.map(p => renderProblemCard(p, 'citizen')).join('');
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
            let list = problems.filter(p => p.assigned_to === currentUser.id || (!p.assigned_to && p.department === currentUser.department));
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
            const myProbs = problems.filter(p => p.assigned_to === currentUser.id || (!p.assigned_to && p.department === currentUser.department));
            const pen = myProbs.filter(p => p.status === 'pending').length, prog = myProbs.filter(p => p.status === 'progress').length, comp = myProbs.filter(p => p.status === 'completed' || p.status === 'closed').length;
            document.getElementById('totalAssigned').textContent = myProbs.length; document.getElementById('totalInProgress').textContent = prog; document.getElementById('totalSolved').textContent = comp; document.getElementById('successRate').textContent = myProbs.length ? Math.round((comp / myProbs.length) * 100) + '%' : '0%';
            renderStatusChart('officialStatsChart', [pen, prog, comp], true);
        }

        function openStatusUpdate(id) { 
            document.getElementById('updateProblemId').value = id; 
            document.getElementById('newStatus').value = 'progress';
            document.getElementById('proofUploadSection').classList.add('hidden');
            clearProofImage();
            document.getElementById('statusUpdateModal').classList.remove('hidden'); 
        }
        document.getElementById('newStatus').addEventListener('change', e => document.getElementById('proofUploadSection').classList.toggle('hidden', e.target.value !== 'completed'));
        function closeStatusUpdate() { document.getElementById('statusUpdateModal').classList.add('hidden'); }
        async function updateProblemStatus(e) {
            e.preventDefault(); const id = document.getElementById('updateProblemId').value, status = document.getElementById('newStatus').value, proofFile = document.getElementById('proofImage').files[0];
            if (status === 'completed' && !proofFile && !capturedProofBlob) return showPopup('warning', 'Proof required');
            
            // Use formData to support image file uploads
            const formData = new FormData();
            formData.append('status', status);
            if (proofFile) formData.append('proofImage', proofFile);
            else if (capturedProofBlob) formData.append('proofImage', capturedProofBlob, 'proof.jpg');
            
            try { 
                const headers = {};
                if (apiToken) headers['Authorization'] = 'Bearer ' + apiToken;
                const res = await fetch(API_BASE + `/problems/${id}/status`, { method: 'PUT', headers, body: formData });
                if (!res.ok) { let err; try { err = (await res.json()).error; } catch(e) { err = res.statusText; } throw new Error(err); }
                closeStatusUpdate(); await syncData(); loadOfficialProblems(); showPopup('success', 'Updated'); 
            } catch (err) { showPopup('error', err.message); }
        }

        async function deleteProblem(id) {
            if (!confirm('Are you sure you want to delete this ticket? This cannot be undone.')) return;
            try {
                await apiFetch(`/problems/${id}`, 'DELETE');
                showPopup('success', 'Ticket deleted');
                await syncData();
                if (currentUserType === 'citizen') {
                    loadCitizenProblems();
                    loadCitizenProfile();
                } else if (currentUserType === 'admin') {
                    loadAdminOverview();
                    loadAdminFeedbacks();
                    if (!document.getElementById('adminTickets').classList.contains('hidden')) {
                        loadAdminTickets();
                    }
                    if (!document.getElementById('adminTicketDetailsModal').classList.contains('hidden')) {
                        closeAdminTicketDetails();
                    }
                }
            } catch (e) { showPopup('error', e.message); }
        }

        async function showAdminSection(section) {
            ['adminOverview', 'adminUsers', 'adminOfficials', 'adminFeedbacks', 'adminTickets'].forEach(id => document.getElementById(id).classList.add('hidden'));
            document.getElementById('admin' + section.charAt(0).toUpperCase() + section.slice(1)).classList.remove('hidden');
            await syncData();
            if (section === 'overview') loadAdminOverview(); 
            else if (section === 'users') loadAdminUsers(); 
            else if (section === 'officials') loadAdminOfficials(); 
            else if (section === 'feedbacks') loadAdminFeedbacks();
            else if (section === 'tickets') loadAdminTickets();
        }

        function loadAdminTickets() {
            const list = document.getElementById('adminTicketsList');
            const search = document.getElementById('adminTicketSearch').value.toLowerCase();
            const filtered = problems.filter(p => p.id.toLowerCase().includes(search));
            
            if (filtered.length === 0) {
                list.innerHTML = '<tr><td colspan="4" class="px-6 py-10 text-center text-slate-500 font-medium">No tickets found matching your search.</td></tr>';
                return;
            }
            
            const colors = { pending: 'bg-yellow-100 text-yellow-800', progress: 'bg-blue-100 text-blue-800', completed: 'bg-emerald-100 text-emerald-800', closed: 'bg-slate-200 text-slate-800' };
            
            list.innerHTML = filtered.map(p => `
                <tr class="hover:bg-slate-50 transition cursor-pointer" onclick="viewAdminTicketDetails('${p.id}')">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-700">${p.id}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-600">${getDepartmentName(p.department)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm"><span class="px-2 py-1 rounded-md text-xs font-bold ${colors[p.status]} uppercase">${p.status}</span></td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onclick="event.stopPropagation(); deleteProblem('${p.id}')" class="text-red-500 hover:text-red-700 font-bold transition">Delete</button>
                    </td>
                </tr>
            `).join('');
        }

        function viewAdminTicketDetails(id) {
            const p = problems.find(x => x.id === id);
            if (!p) return;
            const body = document.getElementById('adminTicketDetailsBody');
            body.innerHTML = renderProblemCard(p, 'admin');
            document.getElementById('adminTicketDetailsModal').classList.remove('hidden');
        }

        function closeAdminTicketDetails() {
            document.getElementById('adminTicketDetailsModal').classList.add('hidden');
            if (currentUserType === 'admin') loadAdminTickets();
        }
        function loadAdminOverview() {
            document.getElementById('adminStatCitizens').innerText = citizens.length;
            document.getElementById('adminStatOfficials').innerText = officials.length;
            document.getElementById('adminStatTickets').innerText = problems.filter(p => p.status !== 'closed').length;
            document.getElementById('adminStatFeedbacks').innerText = problems.filter(p => p.feedback && p.status === 'completed').length;

            // ── Status counts ──
            const pen = problems.filter(p => p.status === 'pending').length;
            const prog = problems.filter(p => p.status === 'progress').length;
            const comp = problems.filter(p => p.status === 'completed').length;
            const closed = problems.filter(p => p.status === 'closed').length;
            document.getElementById('adminCountPending').textContent = pen;
            document.getElementById('adminCountProgress').textContent = prog;
            document.getElementById('adminCountCompleted').textContent = comp;
            document.getElementById('adminCountClosed').textContent = closed;

            // ── Status Doughnut Chart ──
            if (adminStatusChartInstance) adminStatusChartInstance.destroy();
            const sCtx = document.getElementById('adminStatusChart').getContext('2d');
            adminStatusChartInstance = new Chart(sCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Pending', 'In Progress', 'Completed', 'Closed'],
                    datasets: [{ data: [pen, prog, comp, closed], backgroundColor: ['#fbbf24', '#3b82f6', '#10b981', '#94a3b8'], borderWidth: 0 }]
                },
                options: { responsive: true, cutout: '72%', plugins: { legend: { display: false } } }
            });

            // ── Department Bar Chart ──
            const deptMap = {};
            const deptNames = { water:'Water', roads:'Roads', electricity:'Electricity', waste:'Waste Mgmt', parks:'Parks', health:'Health', drainage:'Drainage', transport:'Transport', fire:'Fire', building:'Building' };
            problems.forEach(p => { deptMap[p.department] = (deptMap[p.department] || 0) + 1; });
            const deptLabels = Object.keys(deptMap).map(k => deptNames[k] || k);
            const deptData = Object.values(deptMap);
            const barColors = ['#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16','#f97316'];
            if (adminDeptChartInstance) adminDeptChartInstance.destroy();
            const dCtx = document.getElementById('adminDeptChart').getContext('2d');
            adminDeptChartInstance = new Chart(dCtx, {
                type: 'bar',
                data: {
                    labels: deptLabels,
                    datasets: [{ label: 'Tickets', data: deptData, backgroundColor: barColors.slice(0, deptLabels.length), borderRadius: 8, borderSkipped: false }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#f1f5f9' } },
                        x: { grid: { display: false } }
                    }
                }
            });

            // ── Recent Tickets Table (latest 8) ──
            const statusColors = { pending: 'text-yellow-700 bg-yellow-100', progress: 'text-blue-700 bg-blue-100', completed: 'text-emerald-700 bg-emerald-100', closed: 'text-slate-600 bg-slate-100' };
            const priorityColors = { low: 'text-slate-500', medium: 'text-amber-600', high: 'text-orange-600', urgent: 'text-red-600 font-bold' };
            const recent = [...problems].sort((a, b) => new Date(b.date_reported) - new Date(a.date_reported)).slice(0, 8);
            document.getElementById('adminRecentTickets').innerHTML = recent.length ? recent.map(p => `
                <tr class="hover:bg-slate-50 transition">
                    <td class="py-2.5 pr-4 font-mono text-xs text-slate-500">${p.id}</td>
                    <td class="py-2.5 pr-4 font-medium">${getDepartmentName(p.department)}</td>
                    <td class="py-2.5 pr-4 text-xs ${priorityColors[p.priority] || ''} uppercase font-semibold">${p.priority}</td>
                    <td class="py-2.5"><span class="px-2 py-0.5 rounded-full text-xs font-bold ${statusColors[p.status] || ''} uppercase">${p.status}</span></td>
                </tr>`).join('') : '<tr><td colspan="4" class="py-6 text-center text-slate-400">No tickets yet.</td></tr>';
        }
        function loadAdminUsers() { document.getElementById('adminCitizensList').innerHTML = citizens.map(c => `<tr><td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${c.id}</td><td class="px-6 py-4 whitespace-nowrap text-sm font-medium">${c.name}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${c.email}</td><td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><button onclick="deleteUser('citizen', '${c.id}')" class="text-red-600 hover:text-red-900">Delete</button></td></tr>`).join(''); }
        function loadAdminOfficials() { document.getElementById('adminOfficialsList').innerHTML = officials.map(o => `<tr><td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${o.id}</td><td class="px-6 py-4 whitespace-nowrap text-sm font-medium">${o.name}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${getDepartmentName(o.department)}</td><td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><button onclick="deleteUser('official', '${o.id}')" class="text-red-600 hover:text-red-900">Delete</button></td></tr>`).join(''); }
        async function deleteUser(type, id) { try { await apiFetch(`/users/${type}/${id}`, 'DELETE'); showPopup('success', type + ' deleted'); await showAdminSection(type === 'citizen' ? 'users' : 'officials'); } catch (e) { showPopup('error', e.message); } }

        function loadAdminFeedbacks() { 
            const list = problems.filter(p => {
                if (p.status !== 'completed' || !p.feedback) return false;
                const lastFeedbackIndex = p.feedback.lastIndexOf('[Citizen]:');
                const lastAdminIndex = p.feedback.lastIndexOf('[Admin: Re-evaluate]');
                return lastFeedbackIndex >= lastAdminIndex;
            });
            document.getElementById('adminFeedbackList').innerHTML = list.length ? list.map(p => renderProblemCard(p, 'admin')).join('') : '<p class="text-slate-500 col-span-2">No pending feedbacks to review.</p>'; 
        }
        async function approveAndClose(id) { try { await apiFetch(`/problems/${id}/admin-action`, 'PUT', { status: 'closed', feedbackAppend: ' [Admin: Approved & Closed]' }); showPopup('success', 'Closed'); await showAdminSection('feedbacks'); } catch (e) { showPopup('error', e.message); } }
        async function reassignToOfficial(id) { try { await apiFetch(`/problems/${id}/admin-action`, 'PUT', { status: 'progress', feedbackAppend: ' [Admin: Re-evaluate]', clearProof: true }); showPopup('success', 'Reassigned'); await showAdminSection('feedbacks'); } catch (e) { showPopup('error', e.message); } }

        document.getElementById('problemImage').addEventListener('change', function (e) { if (e.target.files[0]) { document.getElementById('previewImg').src = URL.createObjectURL(e.target.files[0]); document.getElementById('imagePreview').classList.remove('hidden'); capturedImageBlob = null; } });
        function clearImage() { capturedImageBlob = null; document.getElementById('problemImage').value = ''; document.getElementById('imagePreview').classList.add('hidden'); }
        document.getElementById('proofImage').addEventListener('change', function (e) { if (e.target.files[0]) { document.getElementById('proofPreviewImg').src = URL.createObjectURL(e.target.files[0]); document.getElementById('proofImagePreview').classList.remove('hidden'); capturedProofBlob = null; } });
        function clearProofImage() { capturedProofBlob = null; document.getElementById('proofImage').value = ''; document.getElementById('proofImagePreview').classList.add('hidden'); }

        // ── Mobile Navigation Helpers ────────────────────────────────────
        function toggleMobileNav(id) {
            const nav = document.getElementById(id);
            if (!nav) return;
            const isOpen = nav.style.display === 'flex';
            nav.style.display = isOpen ? 'none' : 'flex';
        }
        function closeMobileNav(id) {
            const nav = document.getElementById(id);
            if (nav) nav.style.display = 'none';
        }
        // Close mobile nav when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('nav')) {
                ['citizenMobileNav', 'officialMobileNav', 'adminMobileNav'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                });
            }
        });

        document.addEventListener('DOMContentLoaded', () => { initializeSampleData(); showUserTypeSelection(); });

        // ══════════════════════════════════════════════════════════════════
        //  🔔  NOTIFICATION BELL  (polls every 30 s + offline history sync)
        // ══════════════════════════════════════════════════════════════════
        let notifPollingInterval = null;
        let lastKnownStatuses = {};
        let notifLog = [];
        let notifUnread = 0;

        // ── Official Notification State ──────────────────────────────────────
        let offNotifPollingInterval = null;
        let offLastKnownStatuses = {}; // ticketId → { status, feedbackLen }
        let offNotifLog = [];
        let offNotifUnread = 0;

        function updateNotificationSnapshot() {
            if (!currentUser || currentUserType !== 'citizen') return;
            let changed = false;
            problems.filter(p => p.citizen_id === currentUser.id).forEach(p => {
                const prev = lastKnownStatuses[p.id];
                if (prev && prev !== p.status) {
                    const statusLabels = { pending:'Pending', progress:'In Progress', completed:'Completed', closed:'Closed' };
                    const msg = `Ticket ${p.id}: "${statusLabels[prev]||prev}" → "${statusLabels[p.status]||p.status}"`;
                    notifLog.unshift({ id: p.id, msg, time: new Date() });
                    notifUnread++;
                    lastKnownStatuses[p.id] = p.status;
                    showPopup('info', '🔔 ' + msg);
                    changed = true;
                } else if (!prev) {
                    lastKnownStatuses[p.id] = p.status;
                    changed = true;
                }
            });
            if (changed) {
                renderNotifBadge();
                localStorage.setItem('notifState_' + currentUser.id, JSON.stringify({
                    statuses: lastKnownStatuses, log: notifLog, unread: notifUnread
                }));
            }
        }

        function startNotificationPolling() {
            if (notifPollingInterval) return;
            
            // Restore history from localStorage
            if (currentUser && currentUserType === 'citizen') {
                const saved = localStorage.getItem('notifState_' + currentUser.id);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    lastKnownStatuses = parsed.statuses || {};
                    notifLog = parsed.log || [];
                    notifUnread = parsed.unread || 0;
                    renderNotifBadge();
                }
            }
            
            updateNotificationSnapshot();
            
            notifPollingInterval = setInterval(async () => {
                if (!apiToken || currentUserType !== 'citizen') return;
                try {
                    const fresh = await apiFetch('/problems');
                    problems = fresh;
                    updateNotificationSnapshot();
                } catch (_) {}
            }, 30000);
        }

        function stopNotificationPolling() {
            if (notifPollingInterval) { clearInterval(notifPollingInterval); notifPollingInterval = null; }
            notifUnread = 0; notifLog = []; lastKnownStatuses = {};
            renderNotifBadge();
        }

        // ══════════════════════════════════════════════════════════════════
        //  🔔  OFFICIAL NOTIFICATION SYSTEM
        // ══════════════════════════════════════════════════════════════════
        function updateOfficialNotificationSnapshot() {
            if (!currentUser || currentUserType !== 'official') return;
            let changed = false;
            const myTickets = problems.filter(p => p.assigned_to === currentUser.id || (!p.assigned_to && p.department === currentUser.department));
            myTickets.forEach(p => {
                const prev = offLastKnownStatuses[p.id];
                const feedbackLen = p.feedback ? p.feedback.length : 0;
                if (!prev) {
                    offLastKnownStatuses[p.id] = { status: p.status, feedbackLen };
                    changed = true;
                } else {
                    // New ticket assigned (status change)
                    if (prev.status !== p.status) {
                        const statusLabels = { pending:'Pending', progress:'In Progress', completed:'Completed', closed:'Closed' };
                        const msg = `Ticket ${p.id} status changed: "${statusLabels[prev.status]||prev.status}" → "${statusLabels[p.status]||p.status}"`;
                        offNotifLog.unshift({ id: p.id, msg, time: new Date(), type: 'status' });
                        offNotifUnread++;
                        offLastKnownStatuses[p.id].status = p.status;
                        showPopup('info', '🔔 ' + msg);
                        changed = true;
                    }
                    // Citizen feedback received
                    if (feedbackLen > prev.feedbackLen) {
                        const msg = `Citizen replied on Ticket ${p.id} — new message received.`;
                        offNotifLog.unshift({ id: p.id, msg, time: new Date(), type: 'feedback' });
                        offNotifUnread++;
                        offLastKnownStatuses[p.id].feedbackLen = feedbackLen;
                        showPopup('info', '💬 ' + msg);
                        changed = true;
                    }
                }
            });
            if (changed) {
                renderOfficialNotifBadge();
                localStorage.setItem('offNotifState_' + currentUser.id, JSON.stringify({
                    statuses: offLastKnownStatuses, log: offNotifLog, unread: offNotifUnread
                }));
            }
        }

        function startOfficialNotificationPolling() {
            if (offNotifPollingInterval) return;
            if (currentUser && currentUserType === 'official') {
                const saved = localStorage.getItem('offNotifState_' + currentUser.id);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    offLastKnownStatuses = parsed.statuses || {};
                    offNotifLog = parsed.log || [];
                    offNotifUnread = parsed.unread || 0;
                    renderOfficialNotifBadge();
                }
            }
            updateOfficialNotificationSnapshot();
            offNotifPollingInterval = setInterval(async () => {
                if (!apiToken || currentUserType !== 'official') return;
                try {
                    const fresh = await apiFetch('/problems');
                    problems = fresh;
                    updateOfficialNotificationSnapshot();
                } catch (_) {}
            }, 30000);
        }

        function stopOfficialNotificationPolling() {
            if (offNotifPollingInterval) { clearInterval(offNotifPollingInterval); offNotifPollingInterval = null; }
            offNotifUnread = 0; offNotifLog = []; offLastKnownStatuses = {};
            renderOfficialNotifBadge();
        }

        function renderOfficialNotifBadge() {
            const badge = document.getElementById('offNotifBadge');
            const badgeMob = document.getElementById('offNotifBadgeMobile');
            if (badge) {
                if (offNotifUnread > 0) {
                    badge.textContent = offNotifUnread > 9 ? '9+' : offNotifUnread;
                    badge.classList.remove('hidden');
                } else { badge.classList.add('hidden'); }
            }
            if (badgeMob) {
                if (offNotifUnread > 0) {
                    badgeMob.textContent = offNotifUnread > 9 ? '9+' : offNotifUnread;
                    badgeMob.classList.remove('hidden');
                } else { badgeMob.classList.add('hidden'); }
            }
        }

        function toggleOfficialNotificationPanel() {
            const panel = document.getElementById('offNotifPanel');
            if (!panel) return;
            panel.classList.toggle('hidden');
            if (!panel.classList.contains('hidden')) renderOfficialNotifPanel();
        }

        function renderOfficialNotifPanel() {
            const list = document.getElementById('offNotifList');
            const empty = document.getElementById('offNotifEmpty');
            if (!list) return;
            if (offNotifLog.length === 0) {
                list.innerHTML = '';
                if (empty) empty.classList.remove('hidden');
            } else {
                if (empty) empty.classList.add('hidden');
                list.innerHTML = offNotifLog.slice(0, 50).map(n => {
                    const t = new Date(n.time).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
                    const icon = n.type === 'feedback' ? '💬' : '🔔';
                    return `<li class="px-4 py-3 text-sm hover:bg-slate-50 cursor-pointer" onclick="openMsgHistory('${n.id}')">` +
                        `<p class="text-slate-800 font-medium">${icon} ${n.msg}</p>` +
                        `<p class="text-slate-400 text-xs mt-0.5">${t} — click to view thread</p>` +
                        `</li>`;
                }).join('');
            }
        }

        function clearOfficialNotifications() {
            offNotifUnread = 0;
            if (currentUser) {
                localStorage.setItem('offNotifState_' + currentUser.id, JSON.stringify({
                    statuses: offLastKnownStatuses, log: offNotifLog, unread: offNotifUnread
                }));
            }
            renderOfficialNotifBadge(); renderOfficialNotifPanel();
            document.getElementById('offNotifPanel').classList.add('hidden');
        }

        document.addEventListener('click', e => {
            if (!e.target.closest('#offNotifBellBtn') && !e.target.closest('#offNotifPanel')) {
                const p = document.getElementById('offNotifPanel');
                if (p) p.classList.add('hidden');
            }
        }, true);

        function renderNotifBadge() {
            const badge = document.getElementById('notifBadge');
            if (!badge) return;
            if (notifUnread > 0) {
                badge.textContent = notifUnread > 9 ? '9+' : notifUnread;
                badge.classList.remove('hidden');
            } else { badge.classList.add('hidden'); }
        }

        function toggleNotificationPanel() {
            const panel = document.getElementById('notifPanel');
            if (!panel) return;
            panel.classList.toggle('hidden');
            if (!panel.classList.contains('hidden')) renderNotifPanel();
        }

        function renderNotifPanel() {
            const list = document.getElementById('notifList');
            const empty = document.getElementById('notifEmpty');
            if (!list) return;
            if (notifLog.length === 0) {
                list.innerHTML = '';
                if (empty) empty.classList.remove('hidden');
            } else {
                if (empty) empty.classList.add('hidden');
                list.innerHTML = notifLog.slice(0, 50).map(n => {
                    const t = new Date(n.time).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
                    return `<li class="px-4 py-3 text-sm hover:bg-slate-50 cursor-pointer" onclick="openMsgHistory('${n.id}')">
                        <p class="text-slate-800 font-medium">🔔 ${n.msg}</p>
                        <p class="text-slate-400 text-xs mt-0.5">${t} — click to view</p>
                    </li>`;
                }).join('');
            }
        }

        function clearNotifications() {
            notifUnread = 0;
            if (currentUser) {
                localStorage.setItem('notifState_' + currentUser.id, JSON.stringify({
                    statuses: lastKnownStatuses, log: notifLog, unread: notifUnread
                }));
            }
            renderNotifBadge(); renderNotifPanel();
            document.getElementById('notifPanel').classList.add('hidden');
        }

        document.addEventListener('click', e => {
            if (!e.target.closest('#notifBellBtn') && !e.target.closest('#notifPanel')) {
                const p = document.getElementById('notifPanel');
                if (p) p.classList.add('hidden');
            }
        }, true);

        // ══════════════════════════════════════════════════════════════════
        //  🔍  CITIZEN SEARCH FILTER  (real-time keyword filter)
        // ══════════════════════════════════════════════════════════════════
        function searchCitizenProblems(query) {
            const q = query.toLowerCase().trim();
            const myProbs = problems.filter(p => p.citizen_id === currentUser.id);
            const filtered = q ? myProbs.filter(p =>
                (p.id && p.id.toLowerCase().includes(q)) ||
                (p.description && p.description.toLowerCase().includes(q)) ||
                (p.location && p.location.toLowerCase().includes(q)) ||
                (getDepartmentName(p.department).toLowerCase().includes(q)) ||
                (p.status && p.status.toLowerCase().includes(q))
            ) : myProbs;
            const container = document.getElementById('citizenProblems');
            if (filtered.length === 0) {
                container.innerHTML = `<div class="py-8 text-center text-slate-400 text-sm">No tickets match "${query}"</div>`;
            } else {
                container.innerHTML = filtered.slice(0, 10).map(p => renderProblemCard(p, 'citizen')).join('');
            }
        }

        // ══════════════════════════════════════════════════════════════════
        //  💬  MESSAGE HISTORY MODAL  (chat-bubble thread viewer)
        // ══════════════════════════════════════════════════════════════════
        function openMsgHistory(id) {
            const p = problems.find(x => x.id === id);
            if (!p) return showPopup('error', 'Ticket not found');
            document.getElementById('msgHistoryTicketId').textContent = `Ticket ID: ${p.id} • ${getDepartmentName(p.department)}`;
            const body = document.getElementById('msgHistoryBody');
            if (!p.feedback || p.feedback.trim() === '') {
                body.innerHTML = `<div class="py-10 text-center text-slate-400 text-sm">No messages yet for this ticket.</div>`;
            } else {
                // Parse feedback string into message objects
                // Format: "[Role]: message" separated by newlines or concatenated
                const raw = p.feedback;
                // Split on known prefixes
                const parts = raw.split(/(?=\[(?:Citizen|Admin)[^\]]*\]:)/g).filter(s => s.trim());
                body.innerHTML = parts.map(part => {
                    part = part.trim();
                    const isCitizen = part.startsWith('[Citizen]');
                    const isAdmin = part.startsWith('[Admin');
                    let label = '', text = part, badgeColor = '';
                    if (isCitizen) {
                        const m = part.match(/^\[Citizen\]:\s*([\s\S]*)/);
                        label = 'Citizen'; 
                        text = m ? m[1].trim() : part;
                        text = text.replace(/\[Admin:[^\]]*\]/g, '').trim();
                        badgeColor = 'bg-blue-100 text-blue-800';
                    } else if (isAdmin) {
                        const m = part.match(/^\[Admin[^\]]*\]:\s*([\s\S]*)/);
                        const tagM = part.match(/^\[Admin([^\]]*)\]/);
                        label = 'Admin' + (tagM && tagM[1] ? tagM[1] : '');
                        text = m ? m[1].trim() : part;
                        badgeColor = 'bg-amber-100 text-amber-800';
                    } else {
                        // System/Official message
                        label = 'System'; text = part;
                        badgeColor = 'bg-slate-100 text-slate-600';
                    }
                    const align = isCitizen ? 'items-end' : 'items-start';
                    const bubble = isCitizen
                        ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm'
                        : isAdmin
                            ? 'bg-amber-50 border border-amber-200 text-slate-800 rounded-2xl rounded-bl-sm'
                            : 'bg-slate-100 text-slate-700 rounded-2xl rounded-bl-sm';
                    if (!text) return '';
                    return `<div class="flex flex-col ${align} gap-1">
                        <span class="text-xs font-bold px-2 py-0.5 rounded-full ${badgeColor}">${label}</span>
                        <div class="max-w-[85%] px-4 py-2.5 text-sm ${bubble} shadow-sm whitespace-pre-wrap">${text}</div>
                    </div>`;
                }).join('');
            }
            document.getElementById('msgHistoryModal').classList.remove('hidden');
        }

        // ══════════════════════════════════════════════════════════════════
        //  🖨️  PRINT TICKET  (modal preview + browser print)
        // ══════════════════════════════════════════════════════════════════
        function printTicket(id) {
            const p = problems.find(x => x.id === id);
            if (!p) return showPopup('error', 'Ticket not found');
            const statusColors = { pending:'#f59e0b', progress:'#3b82f6', completed:'#10b981', closed:'#6b7280' };
            const dateStr = p.date_reported ? new Date(p.date_reported).toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) : 'N/A';
            const stars = p.rating ? ('⭐'.repeat(p.rating) + '☆'.repeat(5 - p.rating) + ` (${p.rating}/5)`) : 'Not yet rated';
            const rows = [
                ['Ticket ID', p.id], ['Department', getDepartmentName(p.department)],
                ['Priority', p.priority.toUpperCase()], ['Location', p.location],
                ['Description', p.description], ['Date Reported', dateStr],
                ['Status', p.status.toUpperCase()], ['Citizen Rating', stars]
            ];
            document.getElementById('printTicketContent').innerHTML = `
                <div style="border:2px solid #e2e8f0;border-radius:12px;padding:20px;background:#f8fafc;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                        <div>
                            <p style="font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;margin:0;">SmartConnect Municipal Portal</p>
                            <p style="font-size:18px;font-weight:700;color:#1e293b;margin:4px 0 0;">Ticket Receipt</p>
                        </div>
                        <span style="background:${statusColors[p.status]||'#94a3b8'};color:#fff;padding:4px 12px;border-radius:99px;font-size:12px;font-weight:700;">${p.status.toUpperCase()}</span>
                    </div>
                    <hr style="border:none;border-top:1px solid #e2e8f0;margin:12px 0;">
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        ${rows.map(([l,v]) => `<tr><td style="padding:5px 0;color:#64748b;width:130px;vertical-align:top;">${l}</td><td style="padding:5px 0;font-weight:600;color:#1e293b;">${v}</td></tr>`).join('')}
                    </table>
                </div>`;
            document.getElementById('printModal').classList.remove('hidden');
        }

        // ══════════════════════════════════════════════════════════════════
        //  🗺️  LIVE ISSUE MAP  (Leaflet + color-coded markers)
        // ══════════════════════════════════════════════════════════════════
        let liveMapInstance = null;
        const markerColors = { pending:'#fbbf24', progress:'#3b82f6', completed:'#10b981', closed:'#94a3b8' };

        function openMapViewModal() {
            document.getElementById('mapViewModal').classList.remove('hidden');
            setTimeout(showLiveIssueMap, 250);
        }
        function closeMapViewModal() {
            document.getElementById('mapViewModal').classList.add('hidden');
        }

        function showLiveIssueMap() {
            const mapDiv = document.getElementById('liveIssueMap');
            if (!mapDiv) return;
            // Destroy previous instance so Leaflet doesn't complain about re-init
            if (liveMapInstance) { liveMapInstance.remove(); liveMapInstance = null; }

            const pinned = problems.filter(p => p.lat && p.lng);
            const center = pinned.length > 0 ? [pinned[0].lat, pinned[0].lng] : [20.5937, 78.9629];
            const zoom = pinned.length > 0 ? 12 : 5;

            liveMapInstance = L.map(mapDiv).setView(center, zoom);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors', maxZoom: 19
            }).addTo(liveMapInstance);

            if (pinned.length === 0) {
                const el = document.querySelector('#mapViewModal .text-xs.text-slate-400');
                if (el) el.textContent = 'No tickets with GPS coordinates yet — new tickets submitted with the map picker will appear here.';
                return;
            }

            pinned.forEach(p => {
                const color = markerColors[p.status] || '#94a3b8';
                const icon = L.divIcon({
                    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
                    className: '', iconAnchor: [7, 7]
                });
                const dateStr = p.date_reported ? new Date(p.date_reported).toLocaleDateString('en-IN') : '';
                L.marker([p.lat, p.lng], { icon }).addTo(liveMapInstance).bindPopup(`
                    <div style="font-family:sans-serif;min-width:190px;padding:4px;">
                        <p style="font-weight:700;font-size:13px;margin:0 0 5px;color:#1e293b;">${p.id}</p>
                        <p style="font-size:12px;color:#475569;margin:0 0 2px;">🏢 ${getDepartmentName(p.department)}</p>
                        <p style="font-size:12px;color:#475569;margin:0 0 2px;">⚡ ${p.priority.toUpperCase()} priority</p>
                        <p style="font-size:11px;color:#94a3b8;margin:0 0 6px;">📅 ${dateStr}</p>
                        <span style="background:${color};color:#fff;padding:2px 10px;border-radius:9999px;font-size:11px;font-weight:700;">${p.status.toUpperCase()}</span>
                    </div>`);
            });

            const group = L.featureGroup(pinned.map(p => L.marker([p.lat, p.lng])));
            liveMapInstance.fitBounds(group.getBounds().pad(0.2));

            const infoEl = document.querySelector('#mapViewModal .text-xs.text-slate-400');
            const noPins = problems.length - pinned.length;
            if (infoEl) infoEl.textContent = `${pinned.length} ticket${pinned.length !== 1 ? 's' : ''} on map${noPins ? ` • ${noPins} without GPS` : ''} — click a pin to view details`;
        }
