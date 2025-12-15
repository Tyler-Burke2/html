function handleSubmit(event) {
    event.preventDefault();
    alert('Thank you for your message! I will get back to you soon.');
    event.target.reset();
}

function openResumeModal() {
    document.getElementById('resumeModal').classList.add('active');
}

function closeResumeModal() {
    const modal = document.getElementById('resumeModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function downloadResume() {
    alert('Resume download started! (In a real implementation, this would download a PDF file)');
}

// Close modal when clicking outside
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('resumeModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'resumeModal') {
                closeResumeModal();
            }
        });
    }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeResumeModal();
    }
});

// Smooth scroll for contact link
document.addEventListener('DOMContentLoaded', function() {
    const contactLinks = document.querySelectorAll('a[href="#contact"]');
    contactLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const contactSection = document.getElementById('contact');
            if (contactSection) {
                contactSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
});
