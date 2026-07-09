from scraper import crawl_vendor_site

TEST_URL = "https://opnova.ai/"

if __name__ == "__main__":
    """
    Tests the scraper by crawling a vendor site and printing the results.
    - Crawls the vendor site.
    - Prints the results.
    """
    result = crawl_vendor_site(TEST_URL, max_pages=8)

    print(f"URL: {TEST_URL}")
    print(f"Pages crawled: {result['pages_crawled']}")
    print(f"Word count: {result['word_count']}")
    print("URLs visited:")
    for url in result["urls_crawled"]:
        print(f"  - {url}")
    with open("scraped_output.txt", "w", encoding="utf-8") as f:
        f.write(result["text"])
    print("\nFull text written to scraped_output.txt")
