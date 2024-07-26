using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DataEntryProject.Data;
using DataEntryProject.Models;
using System.Linq;
using System.Threading.Tasks;

namespace DataEntryProject.Controllers
{
    public class CodeWordsController : Controller
    {
        private readonly ApplicationDbContext _context;

        public CodeWordsController(ApplicationDbContext context)
        {
            _context = context;
        }

        // GET: CodeWords
        public async Task<IActionResult> Index()
        {
            return View(await _context.CodeWords.ToListAsync());
        }

        // GET: CodeWords/Create
        public IActionResult Create()
        {
            return View();
        }

        // POST: CodeWords/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create([Bind("Id,Code,Context")] CodeWord codeWord)
        {
            if (ModelState.IsValid)
            {
                _context.Add(codeWord);
                await _context.SaveChangesAsync();
                return RedirectToAction(nameof(Index));
            }
            return View(codeWord);
        }

        // GET: CodeWords/Edit/5
        public async Task<IActionResult> Edit(int? id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var codeWord = await _context.CodeWords.FindAsync(id);
            if (codeWord == null)
            {
                return NotFound();
            }
            return View(codeWord);
        }

        // POST: CodeWords/Edit/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(int id, [Bind("Id,Code,Context")] CodeWord codeWord)
        {
            if (id != codeWord.Id)
            {
                return NotFound();
            }

            if (ModelState.IsValid)
            {
                try
                {
                    _context.Update(codeWord);
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateConcurrencyException)
                {
                    if (!CodeWordExists(codeWord.Id))
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
            return View(codeWord);
        }

        // GET: CodeWords/Delete/5
        public async Task<IActionResult> Delete(int? id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var codeWord = await _context.CodeWords
                .FirstOrDefaultAsync(m => m.Id == id);
            if (codeWord == null)
            {
                return NotFound();
            }

            return View(codeWord);
        }

        // POST: CodeWords/Delete/5
        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> DeleteConfirmed(int id)
        {
            var codeWord = await _context.CodeWords.FindAsync(id);
            _context.CodeWords.Remove(codeWord);
            await _context.SaveChangesAsync();
            return RedirectToAction(nameof(Index));
        }

        private bool CodeWordExists(int id)
        {
            return _context.CodeWords.Any(e => e.Id == id);
        }
    }
}
