const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
} = require("docx");

const createGenericDocTemplate = (doc) => {
  const docContent = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "Generic Document", bold: true, size: 32 }),
            ],
          }),
          new Paragraph({ text: `Document ID: ${doc._id}` }),
          new Paragraph({ text: `Submitted By: ${doc.submittedBy}` }),
        ],
      },
    ],
  });
  return Packer.toBuffer(docContent);
};

const createProposalDocTemplate = async (doc) => {
  // Populate the 'submittedBy' field with 'username'
  await doc.populate("submittedBy", "username");

  // Populate the 'approvedBy.user' field with 'username'
  await doc.populate({
    path: "approvedBy.user", // Populate the 'user' field inside 'approvedBy'
    select: "username", // Get only the 'username'
  });

  // Merge approvers and approvedBy data together
  const mergedApprovals = doc.approvers.map((approver, index) => {
    const approval = doc.approvedBy[index]; // Assuming matching indexes
    return {
      username: approval ? approval.user.username : "",
      approvalDate: approval ? approval.approvalDate : "",
      subRole: approver.subRole,
    };
  });

  const docContent = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "Proposal Document", bold: true, size: 32 }),
            ],
          }),
          new Paragraph({ text: `Document ID: ${doc._id}` }),
          new Paragraph({ text: `Maintenance: ${doc.maintenance}` }),
          new Paragraph({ text: `Cost Center: ${doc.costCenter}` }),
          new Paragraph({ text: `Date of Error: ${doc.dateOfError}` }),
          new Paragraph({ text: `Error Description: ${doc.errorDescription}` }),
          new Paragraph({ text: `Direction: ${doc.direction}` }),
          // Display the username of the person who submitted the document
          new Paragraph({ text: `Submitted By: ${doc.submittedBy.username}` }),

          // Merged approval information
          ...mergedApprovals.map((approval) => {
            return new Paragraph({
              children: [
                new TextRun({
                  text: `Approver: ${approval.username} (Role: ${approval.subRole}) - Approved on: ${approval.approvalDate}`,
                }),
              ],
            });
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(docContent);
};

const createProcessingDocTemplate = async (doc) => {
  // Populate 'submittedBy', 'approvers', 'approvedBy', and 'appendedContent' fields
  await doc.populate("submittedBy", "username"); // Populate submittedBy username
  await doc.populate({
    path: "approvers.approver", // Populate approvers with user details
    select: "username subRole",
  });
  await doc.populate({
    path: "approvedBy.user", // Populate approvedBy with user details
    select: "username",
  });

  const docContent = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "Processing Document",
                bold: true,
                size: 32,
              }),
            ],
          }),
          new Paragraph({
            text: `Document ID: ${doc._id}`,
            spacing: { after: 200 },
          }),
          new Paragraph({
            text: `Submitted By: ${doc.submittedBy.username}`,
            spacing: { after: 200 },
          }),

          // Products Table with explicitly set table and cell widths
          new Paragraph({ text: "Products:", bold: true }),
          new Table({
            width: { size: 100, type: "pct" }, // Set table width to 100% of the page width
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph("Product Name")],
                    width: { size: 25, type: "pct" },
                  }),
                  new TableCell({
                    children: [new Paragraph("Cost Per Unit")],
                    width: { size: 20, type: "pct" },
                  }),
                  new TableCell({
                    children: [new Paragraph("Amount")],
                    width: { size: 15, type: "pct" },
                  }),
                  new TableCell({
                    children: [new Paragraph("Total Cost")],
                    width: { size: 20, type: "pct" },
                  }),
                  new TableCell({
                    children: [new Paragraph("Note")],
                    width: { size: 20, type: "pct" },
                  }),
                ],
              }),
              ...doc.products.map(
                (product) =>
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [new Paragraph(product.productName)],
                        width: { size: 25, type: "pct" },
                      }),
                      new TableCell({
                        children: [
                          new Paragraph(product.costPerUnit.toLocaleString()),
                        ],
                        width: { size: 20, type: "pct" },
                      }),
                      new TableCell({
                        children: [
                          new Paragraph(product.amount.toLocaleString()),
                        ],
                        width: { size: 15, type: "pct" },
                      }),
                      new TableCell({
                        children: [
                          new Paragraph(product.totalCost.toLocaleString()),
                        ],
                        width: { size: 20, type: "pct" },
                      }),
                      new TableCell({
                        children: [new Paragraph(product.note || "N/A")],
                        width: { size: 20, type: "pct" },
                      }),
                    ],
                  })
              ),
            ],
          }),

          // Grand Total Cost
          new Paragraph({
            text: `Grand Total Cost: ${doc.grandTotalCost.toLocaleString()}`,
            spacing: { before: 200 },
          }),

          // Merge Approvers and ApprovedBy
          new Paragraph({ text: "Approvers and Approvals:", bold: true }),
          ...doc.approvers.map((approver) => {
            const approvalRecord = doc.approvedBy.find(
              (approval) =>
                approval.user.toString() === approver.approver.toString()
            );
            return new Paragraph({
              children: [
                new TextRun({
                  text: `Approver: ${approver.username} (Role: ${approver.subRole})`,
                }),
                new TextRun({
                  text: approvalRecord
                    ? ` - Approved on ${approvalRecord.approvalDate}`
                    : "",
                  italic: true,
                }),
              ],
            });
          }),

          // Appended Content
          new Paragraph({ text: "Appended Content:", bold: true }),
          ...doc.appendedContent.map((content, index) => {
            return new Paragraph({
              children: [
                new TextRun({
                  text: `Error Details #${index + 1}:`,
                  bold: true,
                }),
                new TextRun({
                  text: `\nMaintenance: ${content.maintenance}\nCost Center: ${content.costCenter}\nDate of Error: ${content.dateOfError}\nError Description: ${content.errorDescription}\nDirection: ${content.direction}`,
                }),
              ],
            });
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(docContent);
};

const createReportDocTemplate = async (doc) => {
  // Populate necessary fields
  await doc.populate("submittedBy", "username"); // Populate submittedBy username
  await doc.populate({
    path: "approvers.approver",
    select: "username subRole",
  });
  await doc.populate({
    path: "approvedBy.user",
    select: "username",
  });
  await doc.populate("appendedProcessingDocument"); // Populate appended Processing Document

  const docContent = new Document({
    sections: [
      {
        children: [
          // Document Title
          new Paragraph({
            children: [
              new TextRun({ text: "Report Document", bold: true, size: 32 }),
            ],
          }),

          // Document Metadata
          new Paragraph({
            text: `Document ID: ${doc._id}`,
            spacing: { after: 200 },
          }),
          new Paragraph({
            text: `Submitted By: ${doc.submittedBy.username}`,
            spacing: { after: 200 },
          }),

          // Tags and Post-Processing Report
          new Paragraph({ text: "Details:", bold: true }),
          new Paragraph({ text: `Tags: ${doc.tags}` }),
          new Paragraph({
            text: `Post-Processing Report: ${doc.postProcessingReport}`,
            spacing: { after: 200 },
          }),

          // Appended Processing Document Section
          ...(doc.appendedProcessingDocument
            ? [
                new Paragraph({
                  text: "Appended Processing Document:",
                  bold: true,
                }),

                // Products Table
                new Table({
                  width: { size: 100, type: "pct" },
                  rows: [
                    new TableRow({
                      children: [
                        new TableCell({
                          children: [new Paragraph("Product Name")],
                          width: { size: 25, type: "pct" },
                        }),
                        new TableCell({
                          children: [new Paragraph("Cost Per Unit")],
                          width: { size: 20, type: "pct" },
                        }),
                        new TableCell({
                          children: [new Paragraph("Amount")],
                          width: { size: 15, type: "pct" },
                        }),
                        new TableCell({
                          children: [new Paragraph("Total Cost")],
                          width: { size: 20, type: "pct" },
                        }),
                        new TableCell({
                          children: [new Paragraph("Note")],
                          width: { size: 20, type: "pct" },
                        }),
                      ],
                    }),
                    ...doc.appendedProcessingDocument.products.map(
                      (product) =>
                        new TableRow({
                          children: [
                            new TableCell({
                              children: [new Paragraph(product.productName)],
                              width: { size: 25, type: "pct" },
                            }),
                            new TableCell({
                              children: [
                                new Paragraph(
                                  product.costPerUnit.toLocaleString()
                                ),
                              ],
                              width: { size: 20, type: "pct" },
                            }),
                            new TableCell({
                              children: [
                                new Paragraph(product.amount.toLocaleString()),
                              ],
                              width: { size: 15, type: "pct" },
                            }),
                            new TableCell({
                              children: [
                                new Paragraph(
                                  product.totalCost.toLocaleString()
                                ),
                              ],
                              width: { size: 20, type: "pct" },
                            }),
                            new TableCell({
                              children: [new Paragraph(product.note || "N/A")],
                              width: { size: 20, type: "pct" },
                            }),
                          ],
                        })
                    ),
                  ],
                }),

                // Appended Content Section
                ...(doc.appendedProcessingDocument.appendedContent.length
                  ? [
                      new Paragraph({
                        text: "Appended Content:",
                        bold: true,
                        spacing: { before: 200 },
                      }),
                      ...doc.appendedProcessingDocument.appendedContent.map(
                        (content) =>
                          new Paragraph({
                            text: `- Maintenance: ${content.maintenance}, Cost Center: ${content.costCenter}, Date of Error: ${content.dateOfError}, Description: ${content.errorDescription}, Direction: ${content.direction}`,
                          })
                      ),
                    ]
                  : [
                      new Paragraph({
                        text: "No appended content.",
                        italics: true,
                      }),
                    ]),
              ]
            : [
                new Paragraph({
                  text: "No appended processing document.",
                  italics: true,
                }),
              ]),

          // Approvers and ApprovedBy
          new Paragraph({ text: "Approvers and Approvals:", bold: true }),
          ...doc.approvers.map((approver) => {
            const approvalRecord = doc.approvedBy.find(
              (approval) =>
                approval.user.toString() === approver.approver.toString()
            );
            return new Paragraph({
              children: [
                new TextRun({
                  text: `Approver: ${approver.username} (Role: ${approver.subRole})`,
                }),
                new TextRun({
                  text: approvalRecord
                    ? ` - Approved on ${approvalRecord.approvalDate} by ${approvalRecord.username}`
                    : " - Pending Approval",
                  italic: true,
                }),
              ],
            });
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(docContent);
};

module.exports = {
  createGenericDocTemplate,
  createProposalDocTemplate,
  createProcessingDocTemplate,
  createReportDocTemplate,
};
