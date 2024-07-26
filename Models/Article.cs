namespace DataEntryProject.Models
{
    public class Article
    {
        public int Id { get; set; }
        public string Function { get; set; }
        public string CitationSource { get; set; }

        // Classification Symbol subcategories
        public string ClassificationSymbolSubCategory1 { get; set; }
        public string ClassificationSymbolSubCategory2 { get; set; }
        public string ClassificationSymbolSubCategory3 { get; set; }

        // Keywords and Comments
        public string Keywords { get; set; }
        public string Comments { get; set; }

        // Relevance subcategories
        public string RelevanceSubCategory1 { get; set; }
        public string RelevanceSubCategory2 { get; set; }

        // Reason subcategories
        public string ReasonSubCategory1 { get; set; }
        public string ReasonSubCategory2 { get; set; }
    }
}
