document.addEventListener('DOMContentLoaded', () => {
    // State management
    let releaseEntries = []; // Raw entries from backend
    let allNotes = [];       // Flattened and parsed note items
    let filteredNotes = [];  // Current filtered list
    let currentFilter = 'all';
    let searchQuery = '';
    let activeTweetNote = null;

    // DOM Elements
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshSpinner = document.getElementById('refresh-spinner');
    const lastUpdatedTime = document.getElementById('last-updated-time');
    const statTotalNotes = document.getElementById('stat-total-notes');
    const statUpdatesThisMonth = document.getElementById('stat-updates-this-month');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const filterTagsContainer = document.getElementById('filter-tags');
    const skeletonLoading = document.getElementById('skeleton-loading');
    const emptyState = document.getElementById('empty-state');
    const notesStream = document.getElementById('notes-stream');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    
    // Modal DOM Elements
    const tweetModal = document.getElementById('tweet-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalSourcePreview = document.getElementById('modal-source-preview');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCounter = document.getElementById('char-counter');
    const charWarning = document.getElementById('char-warning');
    const tweetPreviewDisplay = document.getElementById('tweet-preview-display');
    const linkPreviewTitle = document.getElementById('link-preview-title');
    const copyTweetBtn = document.getElementById('copy-tweet-btn');
    const postTweetBtn = document.getElementById('post-tweet-btn');

    // Init
    fetchReleaseNotes(false);

    // Event Listeners
    refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
    exportCsvBtn.addEventListener('click', exportToCSV);
    
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
        applyFilters();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        applyFilters();
        searchInput.focus();
    });

    // Tag filtering
    filterTagsContainer.addEventListener('click', (e) => {
        const tag = e.target.closest('.filter-tag');
        if (!tag) return;

        // Toggle active class
        document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
        tag.classList.add('active');

        currentFilter = tag.dataset.type;
        applyFilters();
    });

    // Modal Close
    closeModalBtn.addEventListener('click', closeTweetModal);
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) closeTweetModal();
    });

    // Textarea sync with preview and character count
    tweetTextarea.addEventListener('input', (e) => {
        const text = e.target.value;
        updateTweetPreview(text);
    });

    // Copy Tweet Content
    copyTweetBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        navigator.clipboard.writeText(text).then(() => {
            const originalText = copyTweetBtn.innerHTML;
            copyTweetBtn.innerHTML = '<i class="fa-solid fa-check"></i> <span>Copied!</span>';
            copyTweetBtn.style.borderColor = 'var(--color-feature)';
            copyTweetBtn.style.color = 'var(--color-feature)';
            setTimeout(() => {
                copyTweetBtn.innerHTML = originalText;
                copyTweetBtn.style.borderColor = '';
                copyTweetBtn.style.color = '';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            alert('Could not copy automatically. Please select text manually.');
        });
    });

    // Post to Twitter/X
    postTweetBtn.addEventListener('click', () => {
        const text = encodeURIComponent(tweetTextarea.value);
        const twitterUrl = `https://twitter.com/intent/tweet?text=${text}`;
        window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    });

    // API Call
    async function fetchReleaseNotes(bypassCache = false) {
        setLoadingState(true);
        try {
            const response = await fetch(`/api/releases?refresh=${bypassCache}`);
            const data = await response.json();
            
            if (data.success) {
                releaseEntries = data.entries;
                processReleaseNotes(data.entries);
                updateStats(allNotes);
                
                // Set last updated time
                const lastUpdatedDate = new Date(data.last_fetched);
                lastUpdatedTime.textContent = `Last updated: ${lastUpdatedDate.toLocaleTimeString()} (${data.cached ? 'cached' : 'live'})`;
            } else {
                showError(data.error || 'Failed to fetch release notes.');
            }
        } catch (error) {
            console.error(error);
            showError('Network error or server unavailable.');
        } finally {
            setLoadingState(false);
        }
    }

    // Process & Flatten Entries
    function processReleaseNotes(entries) {
        allNotes = [];
        
        entries.forEach((entry, entryIdx) => {
            const items = parseEntryContent(entry.content);
            
            items.forEach((item, itemIdx) => {
                allNotes.push({
                    id: `note-${entryIdx}-${itemIdx}`,
                    date: entry.title,
                    isoDate: entry.updated,
                    link: entry.link,
                    type: item.type,
                    typeLower: item.type.toLowerCase(),
                    contentHtml: item.contentHtml,
                    contentText: item.contentText
                });
            });
        });

        applyFilters();
    }

    // Parse sub-items inside Atom feed's HTML content
    function parseEntryContent(htmlContent) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const items = [];
        
        let currentType = null;
        let currentElements = [];
        
        const children = Array.from(doc.body.children);
        
        children.forEach((child) => {
            if (child.tagName === 'H3') {
                // Save previous group if it exists
                if (currentType && currentElements.length > 0) {
                    items.push({
                        type: currentType,
                        contentHtml: currentElements.map(el => el.outerHTML).join(''),
                        contentText: currentElements.map(el => el.textContent.trim()).join(' ')
                    });
                }
                // Start new group
                currentType = child.textContent.trim();
                currentElements = [];
            } else {
                if (currentType) {
                    currentElements.push(child);
                } else {
                    // Fallback to "Feature" if there is no H3 preceding elements
                    currentType = 'Feature';
                    currentElements.push(child);
                }
            }
        });
        
        // Push the last group
        if (currentType && currentElements.length > 0) {
            items.push({
                type: currentType,
                contentHtml: currentElements.map(el => el.outerHTML).join(''),
                contentText: currentElements.map(el => el.textContent.trim()).join(' ')
            });
        }
        
        return items;
    }

    // Apply Filter and Search
    function applyFilters() {
        filteredNotes = allNotes.filter(note => {
            const matchesFilter = currentFilter === 'all' || note.typeLower === currentFilter;
            
            const matchesSearch = !searchQuery || 
                note.contentText.toLowerCase().includes(searchQuery) ||
                note.type.toLowerCase().includes(searchQuery) ||
                note.date.toLowerCase().includes(searchQuery);
                
            return matchesFilter && matchesSearch;
        });

        renderNotesStream(filteredNotes);
    }

    // Render Notes
    function renderNotesStream(notes) {
        notesStream.innerHTML = '';
        
        if (notes.length === 0) {
            emptyState.style.display = 'block';
            notesStream.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        notesStream.style.display = 'flex';

        // Group notes by date so we don't repeat the date header card for every sub-item!
        // This is a beautiful aesthetic choice.
        const notesByDate = {};
        notes.forEach(note => {
            if (!notesByDate[note.date]) {
                notesByDate[note.date] = {
                    date: note.date,
                    link: note.link,
                    items: []
                };
            }
            notesByDate[note.date].items.push(note);
        });

        Object.values(notesByDate).forEach(group => {
            const card = document.createElement('div');
            card.className = 'note-group-card';
            
            // Header
            const header = document.createElement('div');
            header.className = 'note-group-header';
            header.innerHTML = `
                <div class="note-group-date">
                    <i class="fa-regular fa-calendar calendar-icon"></i>
                    <h2>${group.date}</h2>
                </div>
                <a href="${group.link}" target="_blank" rel="noopener noreferrer" class="original-link-btn">
                    <span>View Docs</span>
                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </a>
            `;
            card.appendChild(header);

            // Sub-items
            group.items.forEach(note => {
                const noteItem = document.createElement('div');
                noteItem.className = 'note-item';
                noteItem.id = note.id;
                
                // Item Meta (Type badge & Tweet button)
                const meta = document.createElement('div');
                meta.className = 'note-item-meta';
                
                const typePill = document.createElement('span');
                typePill.className = `note-type-pill ${note.typeLower}`;
                typePill.innerHTML = `<span class="badge badge-${note.typeLower}"></span> ${note.type}`;
                
                const actionsContainer = document.createElement('div');
                actionsContainer.className = 'note-actions';

                const copyBtn = document.createElement('button');
                copyBtn.className = 'copy-action-btn';
                copyBtn.innerHTML = `<i class="fa-regular fa-copy"></i> <span>Copy</span>`;
                copyBtn.title = "Copy release note text to clipboard";
                copyBtn.addEventListener('click', () => {
                    const copyText = `BigQuery ${note.type} Update (${note.date}):\n"${note.contentText}"\nRead more: ${note.link}`;
                    navigator.clipboard.writeText(copyText).then(() => {
                        const originalHtml = copyBtn.innerHTML;
                        copyBtn.innerHTML = `<i class="fa-solid fa-check"></i> <span>Copied!</span>`;
                        copyBtn.style.color = 'var(--color-feature)';
                        copyBtn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                        setTimeout(() => {
                            copyBtn.innerHTML = originalHtml;
                            copyBtn.style.color = '';
                            copyBtn.style.borderColor = '';
                        }, 2000);
                    }).catch(err => {
                        console.error('Copy failed', err);
                    });
                });
                
                const tweetBtn = document.createElement('button');
                tweetBtn.className = 'tweet-action-btn';
                tweetBtn.innerHTML = `<i class="fa-brands fa-x-twitter"></i> <span>Tweet</span>`;
                tweetBtn.addEventListener('click', () => openTweetModal(note));
                
                actionsContainer.appendChild(copyBtn);
                actionsContainer.appendChild(tweetBtn);

                meta.appendChild(typePill);
                meta.appendChild(actionsContainer);
                noteItem.appendChild(meta);

                // Content
                const content = document.createElement('div');
                content.className = 'note-content';
                content.innerHTML = note.contentHtml;
                noteItem.appendChild(content);

                card.appendChild(noteItem);
            });

            notesStream.appendChild(card);
        });
    }

    // Stats Calculation
    function updateStats(notes) {
        statTotalNotes.textContent = notes.length;
        
        // Count updates this month (June 2026 in the workspace local time context)
        // Let's use the local time from user metadata (June 2026) to see how many were in June 2026.
        // Wait, the dates from Google feeds are strings like "June 17, 2026". We can inspect if it has "June 2026" or parse them.
        const currentYear = 2026;
        const currentMonthName = 'June';
        
        let countThisMonth = 0;
        notes.forEach(note => {
            if (note.date.includes(currentMonthName) && note.date.includes(String(currentYear))) {
                countThisMonth++;
            }
        });
        
        statUpdatesThisMonth.textContent = countThisMonth;
    }

    // Modal Control
    function openTweetModal(note) {
        activeTweetNote = note;
        
        // Fill preview header
        modalSourcePreview.innerHTML = `
            <span class="note-type-pill ${note.typeLower}">
                <span class="badge badge-${note.typeLower}"></span> ${note.type}
            </span>
            <strong>${note.date}</strong>
        `;

        // Generate draft text
        const cleanContent = cleanTextForTweet(note.contentText);
        
        // Template design
        const headline = `New BigQuery ${note.type}! 🚀`;
        const footer = `\n\nRead more: ${note.link}\n#GCP #BigQuery`;
        
        // Find maximum size of preview snippet to avoid exceeding 280 characters
        const maxSnippetLen = 280 - headline.length - footer.length - 8; // accounts for quotes/spaces
        let snippet = cleanContent;
        if (snippet.length > maxSnippetLen) {
            snippet = snippet.substring(0, maxSnippetLen - 3) + '...';
        }
        
        const defaultTweet = `${headline}\n\n"${snippet}"${footer}`;
        
        tweetTextarea.value = defaultTweet;
        linkPreviewTitle.textContent = `BigQuery Release - ${note.date}`;
        
        updateTweetPreview(defaultTweet);
        
        tweetModal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Lock background scroll
    }

    function closeTweetModal() {
        tweetModal.style.display = 'none';
        document.body.style.overflow = '';
        activeTweetNote = null;
    }

    function updateTweetPreview(text) {
        // Update character count
        const charLen = text.length;
        charCounter.textContent = `${charLen} / 280`;
        
        // Color counter accordingly
        charCounter.className = 'char-count';
        if (charLen >= 250 && charLen < 280) {
            charCounter.classList.add('warning');
            charWarning.style.display = 'inline';
            charWarning.textContent = 'Nearing limit';
            postTweetBtn.disabled = false;
        } else if (charLen > 280) {
            charCounter.classList.add('danger');
            charWarning.style.display = 'inline';
            charWarning.textContent = 'Exceeded limit!';
            postTweetBtn.disabled = true;
        } else {
            charWarning.style.display = 'none';
            postTweetBtn.disabled = false;
        }

        // Parse links to highlight in twitter preview
        // For simplicity, highlight hashtags and links in twitter blue
        let previewHtml = escapeHtml(text)
            .replace(/(#[a-zA-Z0-9_]+)/g, '<span style="color:#1d9bf0;">$1</span>')
            .replace(/(https?:\/\/[^\s]+)/g, '<span style="color:#1d9bf0;">$1</span>');
            
        tweetPreviewDisplay.innerHTML = previewHtml;
    }

    // Utilities
    function setLoadingState(isLoading) {
        if (isLoading) {
            refreshSpinner.classList.add('spinning');
            refreshBtn.disabled = true;
            skeletonLoading.style.display = 'block';
            notesStream.style.display = 'none';
            emptyState.style.display = 'none';
        } else {
            refreshSpinner.classList.remove('spinning');
            refreshBtn.disabled = false;
            skeletonLoading.style.display = 'none';
        }
    }

    function showError(message) {
        notesStream.innerHTML = '';
        emptyState.style.display = 'block';
        notesStream.style.display = 'none';
        
        const h3 = emptyState.querySelector('h3');
        const p = emptyState.querySelector('p');
        const icon = emptyState.querySelector('.empty-icon');
        
        icon.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:var(--color-deprecation);"></i>';
        h3.textContent = 'Failed to load details';
        p.textContent = message;
    }

    function cleanTextForTweet(text) {
        // Strip markdown-like backticks, collapse multiple spaces/newlines, clean punctuation
        return text
            .replace(/`([^`]+)`/g, '$1')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function escapeHtml(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function exportToCSV() {
        if (filteredNotes.length === 0) {
            alert("No data available to export.");
            return;
        }

        const headers = ["Date", "Type", "Content", "Link"];
        
        const escapeCSVValue = (val) => {
            if (val === null || val === undefined) return '';
            let stringVal = String(val);
            stringVal = stringVal.replace(/"/g, '""');
            if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n') || stringVal.includes('\r')) {
                return `"${stringVal}"`;
            }
            return stringVal;
        };

        const rows = [
            headers.join(','),
            ...filteredNotes.map(note => [
                escapeCSVValue(note.date),
                escapeCSVValue(note.type),
                escapeCSVValue(note.contentText),
                escapeCSVValue(note.link)
            ].join(','))
        ];

        const csvContent = rows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `bq_release_notes_${currentFilter}_export.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
});
