from mapping_engine import MappingEngine
from scraper import crawl_vendor_site

engine = MappingEngine()

SCRAPE_VENDOR_URL = "https://opnova.ai/"


def run_test(name, text):
    """
    Runs the mapping test for a given vendor and text.
    - Prints the vendor name and text.
    - Runs the mapping engine.
    - Prints the mapping results.
    """
    print(f"\n{'=' * 60}")
    print(f"Vendor: {name}")
    print(f"{'=' * 60}")

    result = engine.map_vendor(vendor_text=text, vendor_id=None, domain_code="IGA")

    mapping = result["mapping"]
    if isinstance(mapping, dict) and "error" in mapping:
        print("Mapping failed:", mapping["error"])
        return

    print(f"\nCovered ({len(mapping)}):")
    for m in mapping:
        print(f"  {m['use_case_code']} - {m['name']} (conf={m['confidence']})")


if __name__ == "__main__":
    scrape_result = crawl_vendor_site(SCRAPE_VENDOR_URL, max_pages=8)
    print(f"\nScraped {scrape_result['pages_crawled']} pages, "
          f"{scrape_result['word_count']} words from {SCRAPE_VENDOR_URL}")
    run_test(SCRAPE_VENDOR_URL, scrape_result["text"])
