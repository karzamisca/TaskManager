using DataEntryProject.Models;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DataEntryProject.Data;

public class HomeController : Controller
{
    private readonly ApplicationDbContext _context;

    public HomeController(ApplicationDbContext context)
    {
        _context = context;
    }

    // GET: Home/Create
    public IActionResult Create()
    {
        ViewData["ClassificationSymbolOptions"] = new SelectList(_context.CodeWords, "Code", "Context");
        ViewData["RelevanceOptions"] = new SelectList(_context.CodeWords, "Code", "Context");
        ViewData["ReasonOptions"] = new SelectList(_context.CodeWords, "Code", "Context");
        return View();
    }

    // POST: Home/Create
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create([Bind("Id,Function,CitationSource,ClassificationSymbolSubCategory1,ClassificationSymbolSubCategory2,ClassificationSymbolSubCategory3,Keywords,Comments,RelevanceSubCategory1,RelevanceSubCategory2,ReasonSubCategory1,ReasonSubCategory2")] Article article)
    {
        if (ModelState.IsValid)
        {
            _context.Add(article);
            await _context.SaveChangesAsync();
            return RedirectToAction(nameof(Index));
        }
        ViewData["ClassificationSymbolOptions"] = new SelectList(_context.CodeWords, "Code", "Context");
        ViewData["RelevanceOptions"] = new SelectList(_context.CodeWords, "Code", "Context");
        ViewData["ReasonOptions"] = new SelectList(_context.CodeWords, "Code", "Context");
        return View(article);
    }

    // GET: Home/Edit/5
    public async Task<IActionResult> Edit(int? id)
    {
        if (id == null)
        {
            return NotFound();
        }

        var article = await _context.Articles.FindAsync(id);
        if (article == null)
        {
            return NotFound();
        }

        ViewData["ClassificationSymbolOptions"] = new SelectList(_context.CodeWords, "Code", "Context");
        ViewData["RelevanceOptions"] = new SelectList(_context.CodeWords, "Code", "Context");
        ViewData["ReasonOptions"] = new SelectList(_context.CodeWords, "Code", "Context");
        return View(article);
    }

    // POST: Home/Edit/5
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, [Bind("Id,Function,CitationSource,ClassificationSymbolSubCategory1,ClassificationSymbolSubCategory2,ClassificationSymbolSubCategory3,Keywords,Comments,RelevanceSubCategory1,RelevanceSubCategory2,ReasonSubCategory1,ReasonSubCategory2")] Article article)
    {
        if (id != article.Id)
        {
            return NotFound();
        }

        if (ModelState.IsValid)
        {
            try
            {
                _context.Update(article);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!ArticleExists(article.Id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }
            return RedirectToAction(nameof(Index));
        }
        ViewData["ClassificationSymbolOptions"] = new SelectList(_context.CodeWords, "Code", "Context");
        ViewData["RelevanceOptions"] = new SelectList(_context.CodeWords, "Code", "Context");
        ViewData["ReasonOptions"] = new SelectList(_context.CodeWords, "Code", "Context");
        return View(article);
    }

    // GET: Home/Index
    public async Task<IActionResult> Index()
    {
        return View(await _context.Articles.ToListAsync());
    }

    private bool ArticleExists(int id)
    {
        return _context.Articles.Any(e => e.Id == id);
    }
}

