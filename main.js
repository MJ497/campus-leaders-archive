  // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const sectionId = this.getAttribute('data-section');
                showSection(sectionId);
                
                // Update active tab
                document.querySelectorAll('.nav-link').forEach(nav => nav.classList.remove('active-tab'));
                this.classList.add('active-tab');
            });
        });
        
        // Admin tabs
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                const tabId = this.getAttribute('data-admin-tab');
                
                // Update active tab
                document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active-tab'));
                this.classList.add('active-tab');
                
                // Show corresponding content
                document.querySelectorAll('.admin-tab-content').forEach(content => content.classList.add('hidden'));
                document.getElementById(`admin-${tabId}`).classList.remove('hidden');
            });
        });
        
        // Settings tabs
        document.querySelectorAll('[data-settings-tab]').forEach(tab => {
            tab.addEventListener('click', function(e) {
                e.preventDefault();
                const tabId = this.getAttribute('data-settings-tab');
                
                // Update active tab
                document.querySelectorAll('[data-settings-tab]').forEach(t => {
                    t.classList.remove('bg-gray-100');
                    t.classList.add('hover:bg-gray-100');
                });
                this.classList.add('bg-gray-100');
                this.classList.remove('hover:bg-gray-100');
                
                // Show corresponding content
                document.querySelectorAll('.settings-tab-content').forEach(content => content.classList.add('hidden'));
                document.getElementById(`settings-${tabId}`).classList.remove('hidden');
            });
        });
        
        // User menu
        document.getElementById('user-menu-button').addEventListener('click', function() {
            document.getElementById('user-menu').classList.toggle('hidden');
        });
        
        // Show section function
        function showSection(sectionId) {
            // Hide all sections
            document.querySelectorAll('.section').forEach(section => {
                section.classList.remove('active');
            });
            
            // Show requested section
            document.getElementById(sectionId).classList.add('active');
            
            // Special cases
            if (sectionId === 'courses') {
                document.getElementById('course-detail').classList.add('hidden');
            }
            
            // Close user menu if open
            document.getElementById('user-menu').classList.add('hidden');
            
            // Scroll to top
            window.scrollTo(0, 0);
        }
        
        // Course detail navigation
        document.querySelectorAll('[data-section="course-detail"]').forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                document.getElementById('courses').classList.remove('active');
                document.getElementById('course-detail').classList.remove('hidden');
                window.scrollTo(0, 0);
            });
        });
        
        // Initialize with dashboard
        showSection('dashboard');
        
        // Initialize settings tab
        document.querySelector('[data-settings-tab="profile"]').click();
        
        // Run button in code lab
        document.querySelector('#codelab .btn-primary').addEventListener('click', function() {
            const editor = document.querySelector('.code-editor');
            const preview = document.querySelector('.preview-frame');
            preview.srcdoc = editor.value;
        });

        // coures script

          // Toggle course content sections
        document.querySelectorAll('.border-b button').forEach(btn => {
            btn.addEventListener('click', function() {
                const content = this.nextElementSibling;
                content.classList.toggle('hidden');
                
                // Rotate icon if present
                const icon = this.querySelector('i');
                if (icon) {
                    icon.classList.toggle('fa-chevron-down');
                    icon.classList.toggle('fa-chevron-up');
                }
            });
        });
        
        // Join live class functionality
        document.querySelectorAll('.join-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                if (this.textContent.trim() === 'Join Now') {
                    // Simulate joining a live class
                    this.textContent = 'Joined!';
                    this.classList.remove('bg-black', 'hover:bg-gray-800');
                    this.classList.add('bg-green-500', 'hover:bg-green-600');
                    
                    // Show confirmation
                    const toast = document.createElement('div');
                    toast.className = 'fixed bottom-4 right-4 bg-black text-white px-4 py-2 rounded-lg shadow-lg';
                    toast.textContent = 'You have joined the live class!';
                    document.body.appendChild(toast);
                    
                    setTimeout(() => {
                        toast.remove();
                    }, 3000);
                }
            });
        });
        
        // Course card hover effect
        document.querySelectorAll('.course-card').forEach(card => {
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-5px)';
                this.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.1)';
            });
            
            card.addEventListener('mouseleave', function() {
                this.style.transform = '';
                this.style.boxShadow = '';
            });
        });
        
        // Tab switching
        document.querySelectorAll('.flex.border-b button').forEach(tab => {
            tab.addEventListener('click', function() {
                document.querySelectorAll('.flex.border-b button').forEach(t => {
                    t.classList.remove('tab-active');
                });
                this.classList.add('tab-active');
            });
        });
        
        // Simulate navigation
        document.querySelectorAll('[href="#"]').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
            });
        });