document.addEventListener('DOMContentLoaded', () => {
    // Page turning function
    window.turnPage = (pageNum) => {
        document.querySelectorAll('.page').forEach(page => page.style.display = 'none');
        document.getElementById(`page${pageNum}`).style.display = 'block';
        window.scrollTo(0, 0); // Reset scroll to top
    };

    // Smooth scroll and camera pan effect for pages
    const sections = document.querySelectorAll('.story');
    window.addEventListener('scroll', () => {
        const scrollPos = window.scrollY;
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 200;
            const sectionBottom = sectionTop + section.offsetHeight;
            if (scrollPos >= sectionTop && scrollPos < sectionBottom) {
                const offset = (scrollPos - sectionTop) * 0.1;
                section.style.transform = `translateX(${offset}px) rotate(${offset * 0.02}deg)`;
                section.style.opacity = 1 - (scrollPos - sectionTop) / section.offsetHeight * 0.5;
            } else {
                section.style.transform = 'translateX(0) rotate(0)';
                section.style.opacity = 1;
            }
        });
    });

    // Eye tracking cursor (background layer)
    const eyes = document.querySelectorAll('.eye');
    document.addEventListener('mousemove', (e) => {
        eyes.forEach((eye, index) => {
            const eyeX = (index + 1) * 150;
            const eyeY = (index + 1) * 200;
            const angle = Math.atan2(e.clientY - eyeY, e.clientX - eyeX);
            const distance = Math.min(15, Math.hypot(e.clientX - eyeX, e.clientY - eyeY) * 0.2);
            const pupilX = Math.cos(angle) * distance;
            const pupilY = Math.sin(angle) * distance;
            eye.style.left = `${eyeX}px`;
            eye.style.top = `${eyeY}px`;
            eye.querySelector('::after').style.transform = `translate(-50%, -50%) translate(${pupilX}px, ${pupilY}px)`;
        });
    });

    // Artifact and heart positioning and interaction (background layer)
    const artifacts = document.querySelectorAll('.artifact');
    const hearts = document.querySelectorAll('.heart');
    artifacts.forEach((artifact, index) => {
        artifact.style.left = `${200 + index * 250}px`;
        artifact.style.top = `${300 + index * 300}px`;
        artifact.addEventListener('mouseenter', () => {
            artifact.style.transform = 'scale(1.3) rotate(15deg)';
            artifact.style.boxShadow = '0 0 20px #ff0000';
        });
        artifact.addEventListener('mouseleave', () => {
            artifact.style.transform = 'scale(1) rotate(0)';
            artifact.style.boxShadow = 'none';
        });
    });
    hearts.forEach((heart, index) => {
        heart.style.left = `${150 + index * 350}px`;
        heart.style.top = `${400 + index * 250}px`;
    });

    // Random glitch effect on title
    const glitchElements = document.querySelectorAll('.glitch');
    setInterval(() => {
        glitchElements.forEach(el => {
            el.style.animation = 'none';
            setTimeout(() => el.style.animation = 'glitch 1.5s infinite', 200);
        });
    }, 7000);

    // Blood drip effect on hover
    const bloodHighlights = document.querySelectorAll('.blood');
    bloodHighlights.forEach(highlight => {
        highlight.addEventListener('mouseenter', () => {
            highlight.style.textShadow = '0 0 15px #8b0000, 0 10px 10px #8b0000';
        });
        highlight.addEventListener('mouseleave', () => {
            highlight.style.textShadow = '0 0 6px rgba(139, 0, 0, 0.9)';
        });
    });

    // Random "DIE" and "RUN" flashes (on page content)
    const content = document.querySelectorAll('.content');
    setInterval(() => {
        const flash = document.createElement('div');
        flash.textContent = Math.random() > 0.5 ? 'DIE' : 'RUN';
        flash.className = 'flash-text';
        flash.style.left = `${Math.random() * 80 + 10}%`;
        flash.style.top = `${Math.random() * 80 + 10}%`;
        content[Math.floor(Math.random() * content.length)].appendChild(flash);
        setTimeout(() => flash.remove(), 600);
    }, 5000);

    // Shadow movement with cursor (background layer)
    const shadowOverlay = document.querySelector('.shadow-overlay');
    document.addEventListener('mousemove', (e) => {
        shadowOverlay.style.background = `radial-gradient(circle at ${e.clientX}px ${e.clientY}px, transparent 30%, rgba(0, 0, 0, 0.95) 100%)`;
    });

    // Madness effect on final page
    if (document.querySelector('.madness-text')) {
        setInterval(() => {
            const madnessText = document.querySelector('.madness-text p');
            madnessText.style.color = Math.random() > 0.5 ? '#ff0000' : '#000';
        }, 300);
    }
});

// Injected CSS for flash text
const style = document.createElement('style');
style.textContent = `
    .flash-text {
        position: absolute;
        color: #ff0000;
        font-size: 50px;
        font-family: 'Press Start 2P', cursive;
        text-shadow: 0 0 12px #ff0000;
        animation: flash 0.6s ease-out;
        pointer-events: none;
        z-index: 5;
    }
    @keyframes flash {
        0% { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(1.8); }
    }
    .glitch::before,
    .glitch::after {
        content: attr(data-text);
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }
    .glitch::before {
        color: #ff0000;
        left: 4px;
        animation: glitch 1.5s infinite;
    }
    .glitch::after {
        color: #00ff00;
        left: -4px;
        animation: glitch 1.2s infinite reverse;
    }
    @keyframes glitch {
        0% { transform: translate(0); }
        20% { transform: translate(-4px, 4px); }
        40% { transform: translate(4px, -4px); }
        60% { transform: translate(-4px, 0); }
        80% { transform: translate(4px, 0); }
        100% { transform: translate(0); }
    }
`;
document.head.appendChild(style);