using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataEntry.Data.Migrations
{
    /// <inheritdoc />
    public partial class FixArticle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Articles_ClassificationSymbols_ClassificationSymbolId",
                table: "Articles");

            migrationBuilder.DropForeignKey(
                name: "FK_Articles_Reasons_ReasonId",
                table: "Articles");

            migrationBuilder.DropForeignKey(
                name: "FK_Articles_Relevances_RelevanceId",
                table: "Articles");

            migrationBuilder.DropTable(
                name: "ClassificationSymbols");

            migrationBuilder.DropTable(
                name: "Reasons");

            migrationBuilder.DropTable(
                name: "Relevances");

            migrationBuilder.DropIndex(
                name: "IX_Articles_ClassificationSymbolId",
                table: "Articles");

            migrationBuilder.DropIndex(
                name: "IX_Articles_ReasonId",
                table: "Articles");

            migrationBuilder.DropIndex(
                name: "IX_Articles_RelevanceId",
                table: "Articles");

            migrationBuilder.DropColumn(
                name: "ClassificationSymbolId",
                table: "Articles");

            migrationBuilder.DropColumn(
                name: "ReasonId",
                table: "Articles");

            migrationBuilder.DropColumn(
                name: "RelevanceId",
                table: "Articles");

            migrationBuilder.AddColumn<string>(
                name: "ClassificationSymbolSubCategory1",
                table: "Articles",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ClassificationSymbolSubCategory2",
                table: "Articles",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ClassificationSymbolSubCategory3",
                table: "Articles",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ReasonSubCategory1",
                table: "Articles",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ReasonSubCategory2",
                table: "Articles",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "RelevanceSubCategory1",
                table: "Articles",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "RelevanceSubCategory2",
                table: "Articles",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ClassificationSymbolSubCategory1",
                table: "Articles");

            migrationBuilder.DropColumn(
                name: "ClassificationSymbolSubCategory2",
                table: "Articles");

            migrationBuilder.DropColumn(
                name: "ClassificationSymbolSubCategory3",
                table: "Articles");

            migrationBuilder.DropColumn(
                name: "ReasonSubCategory1",
                table: "Articles");

            migrationBuilder.DropColumn(
                name: "ReasonSubCategory2",
                table: "Articles");

            migrationBuilder.DropColumn(
                name: "RelevanceSubCategory1",
                table: "Articles");

            migrationBuilder.DropColumn(
                name: "RelevanceSubCategory2",
                table: "Articles");

            migrationBuilder.AddColumn<int>(
                name: "ClassificationSymbolId",
                table: "Articles",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ReasonId",
                table: "Articles",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "RelevanceId",
                table: "Articles",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "ClassificationSymbols",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SubCategory1 = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SubCategory2 = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SubCategory3 = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClassificationSymbols", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Reasons",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SubCategory1 = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SubCategory2 = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Reasons", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Relevances",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SubCategory1 = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SubCategory2 = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Relevances", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Articles_ClassificationSymbolId",
                table: "Articles",
                column: "ClassificationSymbolId");

            migrationBuilder.CreateIndex(
                name: "IX_Articles_ReasonId",
                table: "Articles",
                column: "ReasonId");

            migrationBuilder.CreateIndex(
                name: "IX_Articles_RelevanceId",
                table: "Articles",
                column: "RelevanceId");

            migrationBuilder.AddForeignKey(
                name: "FK_Articles_ClassificationSymbols_ClassificationSymbolId",
                table: "Articles",
                column: "ClassificationSymbolId",
                principalTable: "ClassificationSymbols",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Articles_Reasons_ReasonId",
                table: "Articles",
                column: "ReasonId",
                principalTable: "Reasons",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Articles_Relevances_RelevanceId",
                table: "Articles",
                column: "RelevanceId",
                principalTable: "Relevances",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
