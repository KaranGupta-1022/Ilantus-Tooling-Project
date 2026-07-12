from collections import deque 
from urllib.parse import urljoin, urlparse

import requests 
from bs4 import BeautifulSoup

WORD_CAP = 2500

NOISE_PATH_KEYWORDS = [
    "blog", "career", "jobs", "legal", "privacy", "terms",
    "login", "signin", "sign-in", "signup", "sign-up", "cookie",
    "press", "news", "events", "support", "help", "docs",
    "documentation", "faq", "about", "contact", "status"
]

NAV_TAGS = ["nav", "header", "footer", "script", "style", "noscript", "svg", "form"]

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
}

NOISE_TEXT_LINES = {
    "blog", "read more", "request a demo", "book a demo", 
    "contact us", "get started", "learn more", "testimonials"
}

# helper functions
def _is_noise_path(path: str) -> bool:
    """
    Lowercases the path and checks if any noise keyword appears in it. 
    Used to filter out links before we ever queue them.
    """
    path_lower = path.lower()
    return any(keyword in path_lower for keyword in NOISE_PATH_KEYWORDS)


def _same_domain(url: str, root_domain: str) -> bool:
    """
    Extracts the domain of URL and compares it (with www. stripped) to root_domain. 
    Keeps the crawl "same-domain" - we never follow links off-site.
    """
    return urlparse(url).netloc.lower().lstrip("www.") == root_domain


def _extract_text(html: str) -> str:
    """
    This is the content-cleaning step:
    - Parses the HTML.
    - Finds and .decompose()s (removes) every nav/header/footer/script/style/noscript/svg/form element - these are navigation/boilerplate, not real content.
    - soup.get_text(separator="\\n", strip=True) - pulls all remaining visible text, using newlines to separate block elements.
    - Filters out duplicate lines and generic marketing button noise line-by-line while preserving paragraph breaks.
    """
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all(NAV_TAGS):
        tag.decompose()
        
    raw_text = soup.get_text(separator="\n", strip=True)
    
    seen_lines = set()
    cleaned_lines = []
    
    # Deduplicate line-by-line and filter noise
    for line in raw_text.split('\n'):
        clean_line = line.strip()
        if not clean_line:
            continue
            
        line_lower = clean_line.lower()
        
        # Skip generic marketing lines or headers to optimize context window
        if line_lower in NOISE_TEXT_LINES:
            continue
            
        if line_lower not in seen_lines:
            seen_lines.add(line_lower)
            cleaned_lines.append(clean_line)
            
    return "\n".join(cleaned_lines)


def _extract_links(html: str, base_url: str, root_domain: str) -> list:
    """
    Finds every <a href="..."> tag:
    - Skips anchors (#), mailto:, tel: links — not crawlable pages. 
    - urljoin(base_url, href) — turns a relative href like /pricing into https://vendor.com/pricing.
    - Strips both #fragments and ?query parameters off the end (avoids duplicate processing of tracking paths).
    - Filters to only http/https schemes (skips javascript:, ftp:, etc.).
    - Filters to same-domain only.
    - Filters out noise paths.
    - Returns the surviving list of candidate URLs to crawl next.
    """
    soup = BeautifulSoup(html, "html.parser")
    links = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href.startswith("#") or href.startswith("mailto:") or href.startswith("tel:"):
            continue
        
        full_url = urljoin(base_url, href)
        full_url = full_url.split("#")[0].split("?")[0]
        
        parsed = urlparse(full_url)
        if parsed.scheme not in ("http", "https"):
            continue
        if not _same_domain(full_url, root_domain):
            continue
        if _is_noise_path(parsed.path):
            continue
        links.append(full_url)
    return links

# main function
def crawl_vendor_site(start_url: str, max_pages: int = 8) -> dict:
    """
    The main function that orchestrates the crawling process:
    - Extracts the root domain from the start URL.
    - Initializes a set of visited URLs, an enqueued tracking tracker, and a queue of URLs to crawl.
    - Combines text from all crawled pages into a single structured string.
    - Limits the crawl to max_pages.
    - Returns a dictionary with the combined text, page count, visited URLs, and word count.
    """
    root_domain = urlparse(start_url).netloc.lower().lstrip("www.")

    visited = set()
    enqueued = {start_url} 
    queue = deque([start_url])
    combined_text_parts = []
    pages_crawled = 0
    urls_crawled = []

    # crawl loop - dequeues a URL, visits it, extracts text, and enqueues all its links.
    while queue and pages_crawled < max_pages:
        url = queue.popleft()
        visited.add(url)

        # visit the URL
        try:
            response = requests.get(url, headers=REQUEST_HEADERS, timeout=10)
            response.raise_for_status()
        except requests.RequestException:
            continue

        # check if the response is HTML
        content_type = response.headers.get("Content-Type", "")
        if "text/html" not in content_type:
            continue

        # extract the text from the response
        page_text = _extract_text(response.text)
        if page_text:
            combined_text_parts.append(page_text)
            pages_crawled += 1
            urls_crawled.append(url)

        # check if we've reached the word limit
        current_word_count = sum(len(part.split()) for part in combined_text_parts)
        if current_word_count >= WORD_CAP:
            break

        # extract the links from the response
        for link in _extract_links(response.text, url, root_domain):
            if link not in visited and link not in enqueued:
                enqueued.add(link)
                queue.append(link)

    # combine the text from all crawled pages into a single string using double newlines
    combined_text = "\n\n".join(combined_text_parts)
    
    # safely truncate to word cap without losing paragraph structure
    words = combined_text.split()
    if len(words) > WORD_CAP:
        allowed_words = 0
        char_limit = 0
        for word in words:
            if allowed_words >= WORD_CAP:
                break
            char_limit = combined_text.find(word, char_limit) + len(word)
            allowed_words += 1
            
        combined_text = combined_text[:char_limit]

    # return the combined text, page count, visited URLs, and word count
    return {
        "text": combined_text,
        "pages_crawled": pages_crawled,
        "urls_crawled": urls_crawled,
        "word_count": len(combined_text.split()),
    }