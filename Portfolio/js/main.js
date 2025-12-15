function handleSubmit(event) {
    event.preventDefault();
    
    // Get form values
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const message = document.getElementById('message').value;
    
    // Create mailto link with form data
    const subject = encodeURIComponent('Portfolio Contact Form');
    const body = encodeURIComponent(
        `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
    );
    
    // Open email client
    window.location.href = `mailto:tylerburke891@gmail.com?subject=${subject}&body=${body}`;
    
    // Reset form after a short delay
    setTimeout(() => {
        event.target.reset();
    }, 100);
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
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = 'UpdatedResume.pdf';
    link.download = 'Tyler_Burke_Resume.pdf';
    
    // Trigger the download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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