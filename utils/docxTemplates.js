const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ExternalHyperlink,
} = require("docx");

const createGenericDocTemplate = async (doc) => {
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
              new TextRun({
                text: "Phiếu chung/Generic Document",
                bold: true,
                size: 32,
              }),
            ],
          }),
          new Paragraph({ text: `Mã phiếu/Document ID: ${doc._id}` }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Tệp đính kèm/Attached File: ",
              }),
              new ExternalHyperlink({
                children: [
                  new TextRun({
                    text: doc.fileMetadata.name,
                    style: "Hyperlink",
                  }),
                ],
                link: doc.fileMetadata.link,
              }),
            ],
          }),
          new Paragraph({
            text: `Được nộp bởi/Submitted By: ${doc.submittedBy.username}`,
          }),

          // Merged approval information
          ...mergedApprovals.map((approval) => {
            return new Paragraph({
              children: [
                new TextRun({
                  text: `Người phê duyệt/Approver: ${approval.username} (Vai trò/Role: ${approval.subRole}) - Phê duyệt vào/Approved on: ${approval.approvalDate}`,
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
              new TextRun({
                text: "Phiếu đề nghị/Proposal Document",
                bold: true,
                size: 32,
              }),
            ],
          }),
          new Paragraph({ text: `Mã phiếu/Document ID: ${doc._id}` }),
          new Paragraph({ text: `Bảo trì/Maintenance: ${doc.maintenance}` }),
          new Paragraph({ text: `Trạm/Center: ${doc.costCenter}` }),
          new Paragraph({
            text: `Ngày xảy ra lỗi/Date of Error: ${doc.dateOfError}`,
          }),
          new Paragraph({
            text: `Mô tả lỗi/Error Description: ${doc.errorDescription}`,
          }),
          new Paragraph({ text: `Hướng xử lý/Direction: ${doc.direction}` }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Tệp đính kèm/Attached File: ",
              }),
              new ExternalHyperlink({
                children: [
                  new TextRun({
                    text: doc.fileMetadata.name,
                    style: "Hyperlink",
                  }),
                ],
                link: doc.fileMetadata.link,
              }),
            ],
          }),
          // Display the username of the person who submitted the document
          new Paragraph({
            text: `Được nộp bởi/Submitted By: ${doc.submittedBy.username}`,
          }),

          // Merged approval information
          ...mergedApprovals.map((approval) => {
            return new Paragraph({
              children: [
                new TextRun({
                  text: `Người phê duyệt/Approver: ${approval.username} (Vai trò/Role: ${approval.subRole}) - Phê duyệt vào/Approved on: ${approval.approvalDate}`,
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
  // Populate referenced fields
  await doc.populate("submittedBy", "username");
  await doc.populate({
    path: "approvers.approver",
    select: "username subRole",
  });
  await doc.populate({
    path: "approvedBy.user",
    select: "username",
  });

  // Document content
  const docContent = new Document({
    sections: [
      {
        children: [
          // Header
          new Paragraph({
            children: [
              new TextRun({
                text: "Phiếu xử lý/Processing Document",
                bold: true,
                size: 32,
              }),
            ],
          }),
          new Paragraph({ text: `Mã phiếu/Document ID: ${doc._id}` }),
          new Paragraph({
            text: `Được nộp bởi/Submitted By: ${doc.submittedBy.username}`,
          }),

          // Products Table
          new Paragraph({ text: "Sản phẩm/Products:", bold: true }),
          new Table({
            width: { size: 100, type: "pct" },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph("Tên sản phẩm/Product Name")],
                    width: { size: 25, type: "pct" },
                  }),
                  new TableCell({
                    children: [new Paragraph("Đơn giá/Cost Per Unit")],
                    width: { size: 20, type: "pct" },
                  }),
                  new TableCell({
                    children: [new Paragraph("Số lượng/Amount")],
                    width: { size: 15, type: "pct" },
                  }),
                  new TableCell({
                    children: [new Paragraph("Tổng tiền/Total Cost")],
                    width: { size: 20, type: "pct" },
                  }),
                  new TableCell({
                    children: [new Paragraph("Ghi chú/Note")],
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
            text: `Chi phí/Grand Total Cost: ${doc.grandTotalCost.toLocaleString()}`,
            spacing: { before: 200 },
          }),

          // File Metadata
          new Paragraph({
            text: "Tệp đính kèm phiếu xử lý/File attaches to processing document:",
            bold: true,
          }),
          doc.fileMetadata
            ? new Paragraph({
                children: [
                  new ExternalHyperlink({
                    children: [
                      new TextRun({
                        text: doc.fileMetadata.name,
                        style: "Hyperlink",
                      }),
                    ],
                    link: doc.fileMetadata.link,
                  }),
                ],
              })
            : new Paragraph({
                text: "Tệp đính kèm phiếu xử lý/File attaches to processing document:",
              }),

          // Approvals
          new Paragraph({ text: "Phê duyệt/Approvals:", bold: true }),
          ...doc.approvers.map((approver) => {
            const approvalRecord = doc.approvedBy.find(
              (approval) =>
                approval.user.toString() === approver.approver.toString()
            );
            return new Paragraph({
              children: [
                new TextRun({
                  text: `Người phê duyệt/Approver: ${approver.username} (Vai trò/Role: ${approver.subRole})`,
                }),
                new TextRun({
                  text: approvalRecord
                    ? ` - Vào lúc/Approved on ${approvalRecord.approvalDate}`
                    : "",
                  italic: true,
                }),
              ],
            });
          }),

          // Appended Content
          new Paragraph({
            text: "Phiếu đề xuất kèm theo/Appended Content:",
            bold: true,
          }),
          ...doc.appendedContent
            .map((content) => [
              new Paragraph({
                text: `Bảo trì/Maintenance: ${content.maintenance}`,
              }),
              new Paragraph({ text: `Trạm/Center: ${content.costCenter}` }),
              new Paragraph({
                text: `Ngày xảy ra lỗi/Date of Error: ${content.dateOfError}`,
              }),
              new Paragraph({
                text: `Mô tả lỗi/Error Description: ${content.errorDescription}`,
              }),
              new Paragraph({
                text: `Hướng xử lý/Direction: ${content.direction}`,
              }),
              content.fileMetadata
                ? new Paragraph({
                    children: [
                      new TextRun({
                        text: "Tệp đính kèm phiếu đề xuất/File attaches to proposal document: ",
                      }),
                      new ExternalHyperlink({
                        children: [
                          new TextRun({
                            text: content.fileMetadata.name,
                            style: "Hyperlink",
                          }),
                        ],
                        link: content.fileMetadata.link,
                      }),
                    ],
                  })
                : new Paragraph({ text: "No Attached File" }),
            ])
            .flat(),
        ],
      },
    ],
  });

  return Packer.toBuffer(docContent);
};

const createReportDocTemplate = async (doc) => {
  // Populate necessary fields
  await doc.populate("submittedBy", "username");
  await doc.populate({
    path: "approvers.approver",
    select: "username subRole",
  });
  await doc.populate({
    path: "approvedBy.user",
    select: "username",
  });
  await doc.populate("appendedProcessingDocument");

  const docContent = new Document({
    sections: [
      {
        children: [
          // Document Title
          new Paragraph({
            children: [
              new TextRun({
                text: "Phiếu báo cáo/Report Document",
                bold: true,
                size: 32,
              }),
            ],
          }),

          // Document Metadata
          new Paragraph({
            text: `Mã phiếu/Document ID: ${doc._id}`,
            spacing: { after: 200 },
          }),
          new Paragraph({
            text: `Được nộp bởi/Submitted By: ${doc.submittedBy.username}`,
            spacing: { after: 200 },
          }),

          // Tags and Post-Processing Report
          new Paragraph({ text: "Chi tiết/Details:", bold: true }),
          new Paragraph({ text: `Tem/Tags: ${doc.tags}` }),
          new Paragraph({
            text: `Báo cáo sau xử lý/Post-Processing Report: ${doc.postProcessingReport}`,
            spacing: { after: 200 },
          }),

          // Main File Metadata Section
          new Paragraph({
            text: "Tệp đính kèm phiếu báo cáo/File attaches to report document:",
            bold: true,
          }),
          doc.fileMetadata
            ? new Paragraph({
                children: [
                  new ExternalHyperlink({
                    children: [
                      new TextRun({
                        text: doc.fileMetadata.name,
                        style: "Hyperlink",
                      }),
                    ],
                    link: doc.fileMetadata.link,
                  }),
                ],
              })
            : new Paragraph({ text: "No Main File Attached", italics: true }),

          // Appended Processing Document Section
          ...(doc.appendedProcessingDocument
            ? [
                new Paragraph({
                  text: "Phiếu xử lý kèm theo/Appended Processing Document:",
                  bold: true,
                }),

                // Main Processing Document File Metadata
                doc.appendedProcessingDocument.fileMetadata
                  ? new Paragraph({
                      children: [
                        new TextRun({
                          text: "Tệp kèm theo phiếu xử lý/File attaches to Processing Document: ",
                        }),
                        new ExternalHyperlink({
                          children: [
                            new TextRun({
                              text: doc.appendedProcessingDocument.fileMetadata
                                .name,
                              style: "Hyperlink",
                            }),
                          ],
                          link: doc.appendedProcessingDocument.fileMetadata
                            .link,
                        }),
                      ],
                    })
                  : new Paragraph({
                      text: "No Processing Document File Attached",
                      italics: true,
                    }),

                // Products Table
                new Table({
                  width: { size: 100, type: "pct" },
                  rows: [
                    new TableRow({
                      children: [
                        new TableCell({
                          children: [
                            new Paragraph("Tên sản phẩm/Product Name"),
                          ],
                          width: { size: 25, type: "pct" },
                        }),
                        new TableCell({
                          children: [new Paragraph("Đơn giá/Cost Per Unit")],
                          width: { size: 20, type: "pct" },
                        }),
                        new TableCell({
                          children: [new Paragraph("Số lượng/Amount")],
                          width: { size: 15, type: "pct" },
                        }),
                        new TableCell({
                          children: [new Paragraph("Thành tiền/Total Cost")],
                          width: { size: 20, type: "pct" },
                        }),
                        new TableCell({
                          children: [new Paragraph("Ghi chú/Note")],
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
                        text: "Phiếu đề xuất kèm theo/Appended Proposal Document:",
                        bold: true,
                        spacing: { before: 200 },
                      }),
                      ...doc.appendedProcessingDocument.appendedContent.flatMap(
                        (content) => [
                          new Paragraph({
                            text: `Bảo trì/Maintenance: ${content.maintenance}`,
                          }),
                          new Paragraph({
                            text: `Trạm/Center: ${content.costCenter}`,
                          }),
                          new Paragraph({
                            text: `Ngày xảy ra lỗi/Date of Error: ${content.dateOfError}`,
                          }),
                          new Paragraph({
                            text: `Mô tả lỗi/Error Description: ${content.errorDescription}`,
                          }),
                          new Paragraph({
                            text: `Hướng xử lý/Direction: ${content.direction}`,
                          }),
                          content.fileMetadata
                            ? new Paragraph({
                                children: [
                                  new TextRun({
                                    text: "Tệp đính kèm phiếu đề xuất/File attaches to proposal document: ",
                                  }),
                                  new ExternalHyperlink({
                                    children: [
                                      new TextRun({
                                        text: content.fileMetadata.name,
                                        style: "Hyperlink",
                                      }),
                                    ],
                                    link: content.fileMetadata.link,
                                  }),
                                ],
                              })
                            : new Paragraph({
                                text: "No Attached File",
                                italics: true,
                              }),
                          new Paragraph({ text: "" }), // Empty line to separate entries
                        ]
                      ),
                    ]
                  : [
                      new Paragraph({
                        text: "Không có phiếu đề xuất kèm theo/No Appended Proposal Document.",
                        italics: true,
                      }),
                    ]),
              ]
            : [
                new Paragraph({
                  text: "Không có phiếu xử lý kèm theo/No appended processing document.",
                  italics: true,
                }),
              ]),

          // Approvers and ApprovedBy
          new Paragraph({ text: "Phê duyệt/Approvals:", bold: true }),
          ...doc.approvers.map((approver) => {
            const approvalRecord = doc.approvedBy.find(
              (approval) =>
                approval.user.toString() === approver.approver.toString()
            );
            return new Paragraph({
              children: [
                new TextRun({
                  text: `Người phê duyệt/Approver: ${approver.username} (Vai trò/Role: ${approver.subRole})`,
                }),
                new TextRun({
                  text: approvalRecord
                    ? ` - Phê duyệt vào/Approved on ${approvalRecord.approvalDate} bởi/by ${approvalRecord.username}`
                    : " - Chưa phê duyệt/Pending Approval",
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
