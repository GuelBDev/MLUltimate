import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const releaseDir = path.join(root, "release");
const workDir = path.join(releaseDir, "online-installer");
const manifestPath = path.join(workDir, "app.manifest");
const csharpPath = path.join(workDir, "MLUltimateInstaller.cs");
const heroPath = path.join(workDir, "launcher-hero.png");
const iconPath = path.join(workDir, "mlultimate-icon.png");
const outputPath = path.join(releaseDir, "MLUltimate Installer.exe");
const windowsSiteOutputPath = path.join(releaseDir, "MLUltimate-Installer-Windows.exe");
const linuxOutputPath = path.join(releaseDir, "MLUltimate-Installer-Linux.sh");
const downloadPagePath = path.join(releaseDir, "download.html");
const downloadLogoPath = path.join(releaseDir, "mlultimate-download-logo.png");
const downloadHeroPath = path.join(releaseDir, "mlultimate-download-hero.png");
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const assemblyVersion = toAssemblyVersion(packageJson.version);

const args = process.argv.slice(2);
const buildWin = args.includes("--win") || args.length === 0;
const buildLinux = args.includes("--linux") || args.length === 0;

if (buildWin) {
  mkdirSync(workDir, { recursive: true });
  copyFileSync(path.join(root, "src/assets/launcher-hero.png"), heroPath);
  copyFileSync(path.join(root, "src/assets/mlultimate-icon.png"), iconPath);
}

copyFileSync(path.join(root, "src/assets/mlultimate-icon.png"), downloadLogoPath);
copyFileSync(path.join(root, "src/assets/launcher-hero.png"), downloadHeroPath);

if (buildWin) {
writeFileSync(
  manifestPath,
  `<?xml version="1.0" encoding="utf-8"?>
<assembly manifestVersion="1.0" xmlns="urn:schemas-microsoft-com:asm.v1">
  <assemblyIdentity version="1.0.0.0" name="MLUltimate.Launcher.Setup" company="MLUltimate"/>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v2">
    <security>
      <requestedPrivileges xmlns="urn:schemas-microsoft-com:asm.v3">
        <requestedExecutionLevel level="asInvoker" uiAccess="false" />
      </requestedPrivileges>
    </security>
  </trustInfo>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}" />
    </application>
  </compatibility>
</assembly>
`
);

writeFileSync(
  csharpPath,
  `using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Windows.Forms;

[assembly: AssemblyTitle("MLUltimate Launcher Setup")]
[assembly: AssemblyDescription("Instalador oficial do MLUltimate Launcher")]
[assembly: AssemblyCompany("MLUltimate")]
[assembly: AssemblyProduct("MLUltimate Launcher")]
[assembly: AssemblyCopyright("Copyright © MLUltimate Team")]
[assembly: AssemblyTrademark("MLUltimate")]
[assembly: AssemblyVersion("${assemblyVersion}")]
[assembly: AssemblyFileVersion("${assemblyVersion}")]
[assembly: Guid("1A2B3C4D-5E6F-7A8B-9C0D-1E2F3A4B5C6D")]

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new InstallerForm());
    }
}

internal class RoundedButton : Control
{
    private int _cornerRadius = 12;
    public int CornerRadius { get { return _cornerRadius; } set { _cornerRadius = value; Invalidate(); } }
    private Color _buttonColor = Color.FromArgb(34, 197, 94);
    public Color ButtonColor { get { return _buttonColor; } set { _buttonColor = value; Invalidate(); } }
    private Color _disabledColor = Color.FromArgb(35, 42, 56);
    public Color DisabledColor { get { return _disabledColor; } set { _disabledColor = value; Invalidate(); } }

    public RoundedButton()
    {
        SetStyle(ControlStyles.SupportsTransparentBackColor |
                 ControlStyles.Opaque |
                 ControlStyles.ResizeRedraw |
                 ControlStyles.UserPaint |
                 ControlStyles.AllPaintingInWmPaint, true);
        BackColor = Color.Transparent;
        Cursor = Cursors.Hand;
        Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
        ForeColor = Color.White;
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        if (Parent != null)
        {
            using (var bgBrush = new SolidBrush(Parent.BackColor))
            {
                e.Graphics.FillRectangle(bgBrush, ClientRectangle);
            }
        }
        var rect = new RectangleF(0, 0, Width - 1, Height - 1);
        using (var path = GetRoundedPath(rect, CornerRadius))
        {
            this.Region = new Region(path);
            var fill = Enabled ? ButtonColor : DisabledColor;
            using (var brush = new SolidBrush(fill))
            {
                e.Graphics.FillPath(brush, path);
            }
            var textColor = Enabled ? ForeColor : Color.FromArgb(100, 116, 139);
            TextRenderer.DrawText(e.Graphics, Text, Font, ClientRectangle, textColor, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }
    }

    private static GraphicsPath GetRoundedPath(RectangleF rect, float radius)
    {
        var path = new GraphicsPath();
        float diameter = radius * 2;
        path.AddArc(rect.X, rect.Y, diameter, diameter, 180, 90);
        path.AddArc(rect.Right - diameter, rect.Y, diameter, diameter, 270, 90);
        path.AddArc(rect.Right - diameter, rect.Bottom - diameter, diameter, diameter, 0, 90);
        path.AddArc(rect.X, rect.Bottom - diameter, diameter, diameter, 90, 90);
        path.CloseFigure();
        return path;
    }
}

internal class RoundedPanel : Panel
{
    private int _cornerRadius = 16;
    public int CornerRadius { get { return _cornerRadius; } set { _cornerRadius = value; } }
    private Color _borderColor = Color.Transparent;
    public Color BorderColor { get { return _borderColor; } set { _borderColor = value; } }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        var rect = new RectangleF(0, 0, Width - 1, Height - 1);
        using (var path = GetRoundedPath(rect, CornerRadius))
        {
            this.Region = new Region(path);
            using (var brush = new SolidBrush(BackColor))
            {
                e.Graphics.FillPath(brush, path);
            }
            if (BorderColor != Color.Transparent)
            {
                using (var pen = new Pen(BorderColor, 1))
                {
                    e.Graphics.DrawPath(pen, path);
                }
            }
        }
    }

    private static GraphicsPath GetRoundedPath(RectangleF rect, float radius)
    {
        var path = new GraphicsPath();
        float diameter = radius * 2;
        path.AddArc(rect.X, rect.Y, diameter, diameter, 180, 90);
        path.AddArc(rect.Right - diameter, rect.Y, diameter, diameter, 270, 90);
        path.AddArc(rect.Right - diameter, rect.Bottom - diameter, diameter, diameter, 0, 90);
        path.AddArc(rect.X, rect.Bottom - diameter, diameter, diameter, 90, 90);
        path.CloseFigure();
        return path;
    }
}

internal sealed class InstallerForm : Form
{
    [DllImport("Gdi32.dll", EntryPoint = "CreateRoundRectRgn")]
    private static extern IntPtr CreateRoundRectRgn(
        int nLeftRect, int nTopRect, int nRightRect, int nBottomRect, int nWidthEllipse, int nHeightEllipse);

    [DllImport("user32.dll")]
    public static extern bool ReleaseCapture();

    [DllImport("user32.dll")]
    public static extern int SendMessage(IntPtr hWnd, int Msg, int wParam, int lParam);

    private const string Repo = "GuelBDev/MLUltimate";
    private const string ApiUrl = "https://api.github.com/repos/" + Repo + "/releases";
    private const string AtomUrl = "https://github.com/" + Repo + "/releases.atom";
    private const string DownloadBase = "https://github.com/" + Repo + "/releases/download";

    private readonly Label title;
    private readonly Label subtitle;
    private readonly ProgressBar progress;
    private readonly Label status;
    private readonly Label step1;
    private readonly Label step2;
    private readonly Label step3;
    private readonly RoundedButton primaryButton;
    private readonly RoundedButton secondaryButton;
    private readonly RoundedPanel contentCard;
    private readonly RichTextBox termsBox;
    private readonly CheckBox acceptTerms;
    private readonly Label folderLabel;
    private readonly TextBox folderText;
    private readonly Label folderNote;
    private readonly Label downloadLabel;
    private readonly Label finalLabel;
    private readonly CheckBox desktopShortcut;
    private readonly CheckBox openNow;
    private string downloadFolder;
    private int stage;

    public InstallerForm()
    {
        Text = "MLUltimate Launcher Setup";
        Width = 960;
        Height = 600;
        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(13, 16, 23);
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        Font = new Font("Segoe UI", 9);

        MouseDown += Form_MouseDown;

        // Custom Close Button
        var closeBtn = new Label();
        closeBtn.Text = "✕";
        closeBtn.AutoSize = false;
        closeBtn.Width = 32;
        closeBtn.Height = 32;
        closeBtn.Location = new Point(915, 12);
        closeBtn.Font = new Font("Segoe UI", 11, FontStyle.Bold);
        closeBtn.ForeColor = Color.FromArgb(148, 163, 184);
        closeBtn.TextAlign = ContentAlignment.MiddleCenter;
        closeBtn.Cursor = Cursors.Hand;
        closeBtn.MouseEnter += delegate { closeBtn.ForeColor = Color.FromArgb(239, 68, 68); };
        closeBtn.MouseLeave += delegate { closeBtn.ForeColor = Color.FromArgb(148, 163, 184); };
        closeBtn.Click += delegate { Close(); };
        Controls.Add(closeBtn);

        // Left Panel (Hero Card with Rounded Corners)
        var leftCard = new RoundedPanel();
        leftCard.Location = new Point(20, 20);
        leftCard.Size = new Size(330, 560);
        leftCard.CornerRadius = 20;
        leftCard.BackColor = Color.FromArgb(20, 25, 35);
        leftCard.MouseDown += Form_MouseDown;
        Controls.Add(leftCard);

        var hero = new PictureBox();
        hero.Dock = DockStyle.Fill;
        hero.SizeMode = PictureBoxSizeMode.StretchImage;
        hero.Image = LoadImage("launcher-hero.png");
        hero.MouseDown += Form_MouseDown;
        leftCard.Controls.Add(hero);

        var brand = new Panel();
        brand.Dock = DockStyle.Bottom;
        brand.Height = 210;
        brand.Padding = new Padding(24);
        brand.BackColor = Color.FromArgb(235, 13, 16, 23);
        brand.MouseDown += Form_MouseDown;
        leftCard.Controls.Add(brand);
        brand.BringToFront();

        var logo = new PictureBox();
        logo.Width = 64;
        logo.Height = 64;
        logo.SizeMode = PictureBoxSizeMode.Zoom;
        logo.Image = LoadImage("mlultimate-icon.png");
        logo.Location = new Point(24, 20);
        logo.MouseDown += Form_MouseDown;
        brand.Controls.Add(logo);

        var brandTitle = new Label();
        brandTitle.Text = "MLUltimate Launcher";
        brandTitle.AutoSize = false;
        brandTitle.Width = 280;
        brandTitle.Height = 32;
        brandTitle.Location = new Point(24, 98);
        brandTitle.Font = new Font("Segoe UI", 16, FontStyle.Bold);
        brandTitle.ForeColor = Color.White;
        brandTitle.MouseDown += Form_MouseDown;
        brand.Controls.Add(brandTitle);

        var brandCopy = new Label();
        brandCopy.Text = "Instalador oficial para manter seu launcher sempre atualizado.";
        brandCopy.AutoSize = false;
        brandCopy.Width = 280;
        brandCopy.Height = 44;
        brandCopy.Location = new Point(24, 134);
        brandCopy.Font = new Font("Segoe UI", 8);
        brandCopy.ForeColor = Color.FromArgb(161, 161, 170);
        brandCopy.MouseDown += Form_MouseDown;
        brand.Controls.Add(brandCopy);

        // Right Content Area
        var badge = new Label();
        badge.Text = "  INSTALADOR OFICIAL  ";
        badge.AutoSize = true;
        badge.Font = new Font("Segoe UI", 8, FontStyle.Bold);
        badge.ForeColor = Color.FromArgb(34, 197, 94);
        badge.BackColor = Color.FromArgb(20, 45, 30);
        badge.Location = new Point(370, 36);
        Controls.Add(badge);

        title = new Label();
        title.Text = "Preparando o MLUltimate";
        title.AutoSize = false;
        title.Width = 530;
        title.Height = 40;
        title.Location = new Point(370, 68);
        title.Font = new Font("Segoe UI", 20, FontStyle.Bold);
        title.ForeColor = Color.White;
        Controls.Add(title);

        subtitle = new Label();
        subtitle.Text = "Este instalador baixa a versao mais recente publicada no GitHub oficial e conclui a instalacao automaticamente.";
        subtitle.AutoSize = false;
        subtitle.Width = 530;
        subtitle.Height = 44;
        subtitle.Location = new Point(370, 114);
        subtitle.Font = new Font("Segoe UI", 9);
        subtitle.ForeColor = Color.FromArgb(161, 161, 170);
        Controls.Add(subtitle);

        // Clean Steps Indicator
        step1 = CreateStep("1. Termos", 370, true);
        step2 = CreateStep("2. Pasta", 480, false);
        step3 = CreateStep("3. Download", 590, false);

        // Main Card Container
        contentCard = new RoundedPanel();
        contentCard.Location = new Point(370, 205);
        contentCard.Size = new Size(540, 250);
        contentCard.CornerRadius = 14;
        contentCard.BackColor = Color.FromArgb(20, 25, 35);
        contentCard.BorderColor = Color.FromArgb(35, 42, 56);
        Controls.Add(contentCard);

        // Step 0 Controls (Terms)
        termsBox = new RichTextBox();
        termsBox.ReadOnly = true;
        termsBox.ScrollBars = RichTextBoxScrollBars.Vertical;
        termsBox.Width = 510;
        termsBox.Height = 220;
        termsBox.Location = new Point(15, 15);
        termsBox.BackColor = Color.FromArgb(20, 25, 35);
        termsBox.ForeColor = Color.FromArgb(161, 161, 170);
        termsBox.BorderStyle = BorderStyle.None;
        termsBox.Font = new Font("Segoe UI", 9);
        termsBox.TabStop = false;
        termsBox.DetectUrls = false;
        termsBox.Text = TermsText();
        termsBox.VScroll += TermsBox_VScroll;
        contentCard.Controls.Add(termsBox);

        acceptTerms = new CheckBox();
        acceptTerms.Text = "Li e aceito os termos de uso";
        acceptTerms.AutoSize = true;
        acceptTerms.Location = new Point(370, 466);
        acceptTerms.Font = new Font("Segoe UI", 9.5f);
        acceptTerms.Enabled = false;
        acceptTerms.ForeColor = Color.FromArgb(100, 116, 139);
        acceptTerms.BackColor = Color.Transparent;
        acceptTerms.FlatStyle = FlatStyle.Standard;
        acceptTerms.CheckedChanged += delegate { StylePrimaryButton(); };
        Controls.Add(acceptTerms);

        // Step 1 Controls (Folder)
        folderLabel = new Label();
        folderLabel.Text = "Pasta de destino para o instalador:";
        folderLabel.AutoSize = false;
        folderLabel.Width = 490;
        folderLabel.Height = 24;
        folderLabel.Location = new Point(20, 30);
        folderLabel.Font = new Font("Segoe UI", 10, FontStyle.Bold);
        folderLabel.ForeColor = Color.White;
        folderLabel.Visible = false;
        contentCard.Controls.Add(folderLabel);

        folderText = new TextBox();
        folderText.Width = 360;
        folderText.Height = 34;
        folderText.Location = new Point(20, 65);
        folderText.BackColor = Color.FromArgb(13, 16, 23);
        folderText.ForeColor = Color.White;
        folderText.BorderStyle = BorderStyle.FixedSingle;
        folderText.Font = new Font("Segoe UI", 9.5f);
        folderText.Visible = false;
        contentCard.Controls.Add(folderText);

        secondaryButton = new RoundedButton();
        secondaryButton.Text = "Procurar";
        secondaryButton.Width = 110;
        secondaryButton.Height = 34;
        secondaryButton.Location = new Point(395, 64);
        secondaryButton.CornerRadius = 8;
        secondaryButton.ButtonColor = Color.FromArgb(35, 42, 56);
        secondaryButton.ForeColor = Color.White;
        secondaryButton.Visible = false;
        secondaryButton.Click += delegate { BrowseFolder(); };
        contentCard.Controls.Add(secondaryButton);

        folderNote = new Label();
        folderNote.Text = "Esta pasta armazenara os arquivos temporarios necessarios durante a instalacao.";
        folderNote.AutoSize = false;
        folderNote.Width = 490;
        folderNote.Height = 40;
        folderNote.Location = new Point(20, 115);
        folderNote.Font = new Font("Segoe UI", 9);
        folderNote.ForeColor = Color.FromArgb(161, 161, 170);
        folderNote.Visible = false;
        contentCard.Controls.Add(folderNote);

        // Step 2 Controls (Download / Progress)
        downloadLabel = new Label();
        downloadLabel.Text = "Baixando e preparando arquivos...";
        downloadLabel.AutoSize = false;
        downloadLabel.Width = 490;
        downloadLabel.Height = 26;
        downloadLabel.Location = new Point(20, 35);
        downloadLabel.Font = new Font("Segoe UI", 10, FontStyle.Bold);
        downloadLabel.ForeColor = Color.White;
        downloadLabel.Visible = false;
        contentCard.Controls.Add(downloadLabel);

        progress = new ProgressBar();
        progress.Minimum = 0;
        progress.Maximum = 100;
        progress.Value = 6;
        progress.Width = 490;
        progress.Height = 16;
        progress.Location = new Point(20, 75);
        progress.Visible = false;
        contentCard.Controls.Add(progress);

        status = new Label();
        status.Text = "Conectando ao GitHub oficial...";
        status.AutoSize = false;
        status.Width = 490;
        status.Height = 45;
        status.Location = new Point(20, 105);
        status.Font = new Font("Segoe UI", 9);
        status.ForeColor = Color.FromArgb(161, 161, 170);
        contentCard.Controls.Add(status);

        // Step 3 Controls (Final)
        finalLabel = new Label();
        finalLabel.Text = "Instalacao concluida com sucesso!";
        finalLabel.AutoSize = false;
        finalLabel.Width = 490;
        finalLabel.Height = 28;
        finalLabel.Location = new Point(20, 30);
        finalLabel.Font = new Font("Segoe UI", 11, FontStyle.Bold);
        finalLabel.ForeColor = Color.FromArgb(34, 197, 94);
        finalLabel.Visible = false;
        contentCard.Controls.Add(finalLabel);

        desktopShortcut = new CheckBox();
        desktopShortcut.Text = "Criar atalho na area de trabalho";
        desktopShortcut.Checked = true;
        desktopShortcut.AutoSize = true;
        desktopShortcut.Location = new Point(20, 75);
        desktopShortcut.Font = new Font("Segoe UI", 9.5f);
        desktopShortcut.ForeColor = Color.White;
        desktopShortcut.BackColor = Color.Transparent;
        desktopShortcut.FlatStyle = FlatStyle.Standard;
        desktopShortcut.Visible = false;
        contentCard.Controls.Add(desktopShortcut);

        openNow = new CheckBox();
        openNow.Text = "Abrir o MLUltimate agora";
        openNow.Checked = true;
        openNow.AutoSize = true;
        openNow.Location = new Point(20, 115);
        openNow.Font = new Font("Segoe UI", 9.5f);
        openNow.ForeColor = Color.White;
        openNow.BackColor = Color.Transparent;
        openNow.FlatStyle = FlatStyle.Standard;
        openNow.Visible = false;
        contentCard.Controls.Add(openNow);

        primaryButton = new RoundedButton();
        primaryButton.Text = "Aceitar e continuar";
        primaryButton.Width = 200;
        primaryButton.Height = 46;
        primaryButton.Location = new Point(370, 510);
        primaryButton.CornerRadius = 12;
        primaryButton.Click += delegate { PrimaryAction(); };
        Controls.Add(primaryButton);

        downloadFolder = Path.Combine(Path.GetTempPath(), "MLUltimate", "Installer");
        ShowTermsStep();
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        Region = Region.FromHrgn(CreateRoundRectRgn(0, 0, Width, Height, 24, 24));
    }

    private void Form_MouseDown(object sender, MouseEventArgs e)
    {
        if (e.Button == MouseButtons.Left)
        {
            ReleaseCapture();
            SendMessage(Handle, 0xA1, 0x2, 0);
        }
    }

    private Label CreateStep(string text, int left, bool active)
    {
        var label = new Label();
        label.Text = text;
        label.AutoSize = false;
        label.Width = 100;
        label.Height = 24;
        label.Location = new Point(left, 168);
        label.Font = new Font("Segoe UI", 9, FontStyle.Bold);
        label.TextAlign = ContentAlignment.MiddleLeft;
        label.BorderStyle = BorderStyle.None;
        label.BackColor = Color.Transparent;
        label.ForeColor = active ? Color.White : Color.FromArgb(100, 116, 139);
        label.MouseDown += Form_MouseDown;
        Controls.Add(label);
        return label;
    }

    private void SetStep(Label label, bool active, bool done)
    {
        label.ForeColor = done
            ? Color.FromArgb(34, 197, 94)
            : active
                ? Color.White
                : Color.FromArgb(100, 116, 139);
    }

    private void StylePrimaryButton()
    {
        primaryButton.Enabled = acceptTerms.Checked || stage != 0;
        primaryButton.ButtonColor = acceptTerms.Checked || stage != 0
            ? Color.FromArgb(34, 197, 94)
            : Color.FromArgb(35, 42, 56);
    }

    private static Image LoadImage(string name)
    {
        var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(name);
        return stream == null ? null : Image.FromStream(stream);
    }

    private void ShowTermsStep()
    {
        title.Text = "Termos de uso";
        subtitle.Text = "Antes de baixar, confirme que voce aceita os termos do instalador oficial do MLUltimate.";
        SetStep(step1, true, false);
        SetStep(step2, false, false);
        SetStep(step3, false, false);

        termsBox.Visible = true;
        termsBox.SelectionStart = 0;
        termsBox.SelectionLength = 0;
        
        acceptTerms.Visible = true;
        acceptTerms.Checked = false;
        acceptTerms.Enabled = false;
        acceptTerms.ForeColor = Color.FromArgb(100, 116, 139);
        TermsBox_VScroll(null, null);

        folderLabel.Visible = false;
        folderText.Visible = false;
        secondaryButton.Visible = false;
        folderNote.Visible = false;
        downloadLabel.Visible = false;
        progress.Visible = false;
        finalLabel.Visible = false;
        desktopShortcut.Visible = false;
        openNow.Visible = false;

        status.Text = "";
        primaryButton.Text = "Aceitar e continuar";
        stage = 0;
        StylePrimaryButton();
    }

    private void ShowFolderStep()
    {
        title.Text = "Escolha onde baixar";
        subtitle.Text = "Escolha a pasta onde o instalador temporario sera baixado antes da instalacao.";
        SetStep(step1, false, true);
        SetStep(step2, true, false);
        SetStep(step3, false, false);

        termsBox.Visible = false;
        acceptTerms.Visible = false;

        folderLabel.Visible = true;
        folderText.Visible = true;
        secondaryButton.Visible = true;
        folderNote.Visible = true;

        downloadLabel.Visible = false;
        progress.Visible = false;
        finalLabel.Visible = false;
        desktopShortcut.Visible = false;
        openNow.Visible = false;

        folderText.Text = downloadFolder;
        status.Text = "";
        primaryButton.Text = "Baixar e instalar";
        stage = 1;
        StylePrimaryButton();
    }

    private void BrowseFolder()
    {
        using (var dialog = new FolderBrowserDialog())
        {
            dialog.Description = "Escolha onde baixar o instalador do MLUltimate";
            dialog.SelectedPath = folderText.Text;
            if (dialog.ShowDialog(this) == DialogResult.OK)
            {
                folderText.Text = dialog.SelectedPath;
            }
        }
    }

    private void StartInstall()
    {
        try
        {
            folderLabel.Visible = false;
            folderText.Visible = false;
            secondaryButton.Visible = false;
            folderNote.Visible = false;

            downloadLabel.Visible = true;
            progress.Visible = true;
            status.Visible = true;

            status.Text = "Conectando ao GitHub oficial...";
            stage = 2;
            StylePrimaryButton();
            var target = FindLatestInstaller();
            if (String.IsNullOrWhiteSpace(target.TagName) || String.IsNullOrWhiteSpace(target.DownloadUrl))
            {
                throw new InvalidOperationException("Nenhum instalador Windows foi encontrado no GitHub.");
            }

            progress.Value = 12;
            status.Text = "Baixando MLUltimate Launcher " + target.TagName + "...";
            SetStep(step1, false, true);
            SetStep(step2, false, true);
            SetStep(step3, true, false);

            var safeTag = Regex.Replace(target.TagName, "[^A-Za-z0-9_.-]", "_");
            downloadFolder = String.IsNullOrWhiteSpace(folderText.Text) ? downloadFolder : folderText.Text;
            Directory.CreateDirectory(downloadFolder);
            var downloadPath = Path.Combine(downloadFolder, "MLUltimate-" + safeTag + "-Setup.exe");

            using (var client = CreateClient())
            {
                client.DownloadProgressChanged += delegate(object sender, DownloadProgressChangedEventArgs args)
                {
                    var value = Math.Min(94, Math.Max(14, args.ProgressPercentage));
                    progress.Value = value;
                    status.Text = "Baixando arquivos do launcher... " + args.ProgressPercentage + "%";
                };
                var finished = new System.Threading.ManualResetEvent(false);
                Exception downloadError = null;
                client.DownloadFileCompleted += delegate(object sender, System.ComponentModel.AsyncCompletedEventArgs args)
                {
                    downloadError = args.Error;
                    finished.Set();
                };
                client.DownloadFileAsync(new Uri(target.DownloadUrl), downloadPath);
                while (!finished.WaitOne(80))
                {
                    Application.DoEvents();
                }
                if (downloadError != null)
                {
                    throw downloadError;
                }
            }

            progress.Value = 96;
            status.Text = "Instalando no Windows...";
            SetStep(step1, false, true);
            SetStep(step2, false, true);
            SetStep(step3, true, false);

            var process = Process.Start(new ProcessStartInfo(downloadPath) { UseShellExecute = true });
            if (process != null)
            {
                process.WaitForExit();
            }

            progress.Value = 100;
            status.Text = "Instalacao concluida. Escolha como finalizar.";
            SetStep(step3, false, true);
            ShowFinalStep();
        }
        catch (Exception error)
        {
            progress.Value = 100;
            status.Text = "Nao foi possivel instalar: " + error.Message;
            primaryButton.Text = "Fechar";
            stage = 4;
            StylePrimaryButton();
        }
    }

    private void ShowFinalStep()
    {
        title.Text = "Tudo pronto";
        subtitle.Text = "O launcher foi instalado. Voce pode criar um atalho e abrir o app agora.";
        SetStep(step1, false, true);
        SetStep(step2, false, true);
        SetStep(step3, false, true);

        downloadLabel.Visible = false;
        progress.Visible = false;
        status.Visible = false;

        finalLabel.Visible = true;
        desktopShortcut.Visible = true;
        openNow.Visible = true;
        primaryButton.Text = "Concluir";
        stage = 3;
        StylePrimaryButton();
    }

    private void PrimaryAction()
    {
        if (stage == 0)
        {
            if (!acceptTerms.Checked)
            {
                status.ForeColor = Color.FromArgb(252, 211, 77);
                status.Text = "Marque a opcao de aceite para continuar.";
                return;
            }
            status.ForeColor = Color.FromArgb(203, 213, 225);
            ShowFolderStep();
        }
        else if (stage == 1)
        {
            StartInstall();
        }
        else if (stage == 3)
        {
            FinishInstall();
        }
        else if (stage == 4)
        {
            Close();
        }
    }

    private void FinishInstall()
    {
        var appPath = FindInstalledApp();
        if (!desktopShortcut.Checked)
        {
            RemoveDesktopShortcut();
        }
        if (openNow.Checked && !String.IsNullOrWhiteSpace(appPath))
        {
            Process.Start(new ProcessStartInfo(appPath) { UseShellExecute = true });
        }
        Close();
    }

    private void TermsBox_VScroll(object sender, EventArgs e)
    {
        if (acceptTerms.Enabled) return;

        int lastCharIndex = termsBox.TextLength - 1;
        if (lastCharIndex >= 0)
        {
            Point p = termsBox.GetPositionFromCharIndex(lastCharIndex);
            if (p.Y <= termsBox.Height + 50)
            {
                acceptTerms.Enabled = true;
                acceptTerms.ForeColor = Color.White;
            }
        }
    }

    private static string TermsText()
    {
        return "Termos de Servico do MLUltimate Launcher\\r\\n\\r\\n" +
            "1. Aceitacao dos Termos: Ao baixar, instalar ou utilizar o MLUltimate Launcher ('Launcher'), voce concorda integralmente com estes Termos de Servico. Se nao concordar, cancele a instalacao.\\r\\n\\r\\n" +
            "2. Fornecimento do Servico ('As-Is'): O Launcher e fornecido 'no estado em que se encontra', sem garantias de qualquer natureza, expressas ou implicitas. Nao garantimos disponibilidade continua dos servicos externos, funcionamento livre de erros ou suporte tecnico vitalicio.\\r\\n\\r\\n" +
            "3. Propriedade Intelectual e Uso Aceitavel: O Launcher facilita a criacao de instancias e download de mods. O usuario compromete-se a respeitar as licencas, direitos autorais e regras dos criadores originais dos mods, modpacks, servidores e do proprio jogo (Minecraft/Mojang AB). O MLUltimate nao possui afiliacao oficial com a Mojang AB ou Microsoft.\\r\\n\\r\\n" +
            "4. Privacidade, Dados e Contas: O uso de contas externas (como contas Microsoft/Xbox) e feito exclusivamente atraves de autenticacao oficial segura. O MLUltimate nao intercepta nem armazena as suas senhas.\\r\\n\\r\\n" +
            "5. Atualizacoes Automaticas: O instalador cria atalhos locais e efetua o download do pacote mais recente e seguro diretamente do repositorio oficial no GitHub. Ao continuar, voce autoriza esta operacao.\\r\\n\\r\\n" +
            "6. Limitacao de Responsabilidade: Os desenvolvedores do MLUltimate nao serao responsaveis por perdas de dados (mundos salvos), banimentos em servidores de terceiros ou danos decorrentes do uso inadequado deste software.\\r\\n\\r\\n" +
            "7. Regras Adicionais: Voce concorda que nao ha qualquer tipo de suporte a versoes alternativas nao autorizadas, este software e restrito ao download do launcher do MLUltimate. Quaisquer alteracoes nos arquivos locais do launcher sao de inteira responsabilidade do usuario final, isentando-nos de perdas.\\r\\n\\r\\n" +
            "8. Termo de Uso da API do GitHub: Ao fazer download via este launcher, as requisições passam pela API oficial do GitHub, logo, voces tambem concordam com os Termos de Uso do GitHub (github.com).\\r\\n\\r\\n" +
            "Por favor, role ate o final para habilitar o botao de aceite.";
    }

    private static string FindInstalledApp()
    {
        var names = new[] { "MLUltimate Launcher.exe", "mlultimate-launcher.exe" };
        var roots = new[]
        {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs"),
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86)
        };
        foreach (var root in roots)
        {
            if (String.IsNullOrWhiteSpace(root) || !Directory.Exists(root)) continue;
            foreach (var name in names)
            {
                var files = Directory.GetFiles(root, name, SearchOption.AllDirectories);
                if (files.Length > 0) return files[0];
            }
        }
        return null;
    }

    private static void RemoveDesktopShortcut()
    {
        var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        var shortcutPath = Path.Combine(desktop, "MLUltimate Launcher.lnk");
        if (File.Exists(shortcutPath))
        {
            File.Delete(shortcutPath);
        }
    }

    private static ReleaseTarget FindLatestInstaller()
    {
        try
        {
            var json = CreateClient().DownloadString(ApiUrl);
            var asset = Regex.Match(json, @"""browser_download_url""\\s*:\\s*""([^""]*/releases/download/([^/""]+)/MLUltimate-Launcher-[^""]*-win-x64\\.exe)""");
            if (asset.Success)
            {
                return new ReleaseTarget(asset.Groups[2].Value, asset.Groups[1].Value.Replace(@"\\/", "/"));
            }
        }
        catch
        {
        }

        var xml = CreateClient().DownloadString(AtomUrl);
        var href = Regex.Match(xml, @"<link[^>]+rel=""alternate""[^>]+href=""([^""]+)""");
        if (!href.Success)
        {
            return new ReleaseTarget(null, null);
        }

        var tag = Uri.UnescapeDataString(WebUtility.HtmlDecode(href.Groups[1].Value).Split('/')[WebUtility.HtmlDecode(href.Groups[1].Value).Split('/').Length - 1]);
        var version = Regex.Replace(tag, "^v", "");
        return new ReleaseTarget(tag, DownloadBase + "/" + tag + "/MLUltimate-Launcher-" + version + "-win-x64.exe");
    }

    private static WebClient CreateClient()
    {
        var client = new WebClient();
        client.Headers.Add("Accept", "application/vnd.github+json");
        client.Headers.Add("User-Agent", "MLUltimate-Installer");
        return client;
    }

    private struct ReleaseTarget
    {
        public readonly string TagName;
        public readonly string DownloadUrl;

        public ReleaseTarget(string tagName, string downloadUrl)
        {
            TagName = tagName;
            DownloadUrl = downloadUrl;
        }
    }
}
`,
);
}

if (buildLinux) {
writeFileSync(
  linuxOutputPath,
  `#!/usr/bin/env bash
set -euo pipefail

repo="GuelBDev/MLUltimate"
api="https://api.github.com/repos/$repo/releases"
download_base="https://github.com/$repo/releases/download"
icon_url="https://raw.githubusercontent.com/$repo/main/src/assets/mlultimate-icon.png"
install_dir="\${XDG_DATA_HOME:-$HOME/.local/share}/MLUltimate"
bin_dir="\${XDG_BIN_HOME:-$HOME/.local/bin}"
desktop_dir="\${XDG_DATA_HOME:-$HOME/.local/share}/applications"
desktop_shortcut_dir="\${XDG_DESKTOP_DIR:-$HOME/Desktop}"
appimage_path="$install_dir/MLUltimate-Launcher.AppImage"
icon_path="$install_dir/mlultimate-icon.png"
wrapper_path="$bin_dir/mlultimate-launcher"
desktop_file="$desktop_dir/mlultimate-launcher.desktop"
desktop_shortcut_file="$desktop_shortcut_dir/MLUltimate Launcher.desktop"

green=""
blue=""
yellow=""
red=""
muted=""
bold=""
reset=""

if [[ -t 1 ]]; then
  green="$(printf '\\033[32m')"
  blue="$(printf '\\033[36m')"
  yellow="$(printf '\\033[33m')"
  red="$(printf '\\033[31m')"
  muted="$(printf '\\033[90m')"
  bold="$(printf '\\033[1m')"
  reset="$(printf '\\033[0m')"
fi

have() {
  command -v "$1" >/dev/null 2>&1
}

header() {
  clear 2>/dev/null || true
  printf '%s\\n' "\${blue}╭────────────────────────────────────────────────────────────╮\${reset}"
  printf '%s\\n' "\${blue}│\${reset} \${bold}MLUltimate Launcher Setup\${reset}                                  \${blue}│\${reset}"
  printf '%s\\n' "\${blue}│\${reset} \${muted}Instalador oficial para Linux 64-bit (Pop!_OS / Ubuntu / Debian)\${reset} \${blue}│\${reset}"
  printf '%s\\n' "\${blue}╰────────────────────────────────────────────────────────────╯\${reset}"
  printf '\\n'
}

step() {
  printf '\\n%s\\n' "\${blue}●\${reset} \${bold}$1\${reset}"
}

ok() {
  printf '%s\\n' "  \${green}✔\${reset} $1"
}

info() {
  printf '%s\\n' "  \${blue}ℹ\${reset} $1"
}

warn() {
  printf '%s\\n' "  \${yellow}!\${reset} $1"
}

die() {
  printf '%s\\n' "\${red}Erro:\${reset} $1" >&2
  if have zenity; then
    zenity --error --title="MLUltimate Launcher Setup" --text="$1" >/dev/null 2>&1 || true
  elif have kdialog; then
    kdialog --error "$1" --title "MLUltimate Launcher Setup" >/dev/null 2>&1 || true
  fi
  exit 1
}

terms_text() {
  cat <<'EOF'
Termos de Serviço do MLUltimate Launcher

1. Aceitação dos Termos: Ao baixar, instalar ou utilizar o MLUltimate Launcher ("Launcher"),
   você concorda integralmente com estes Termos de Serviço. Se não concordar, cancele.

2. Fornecimento do Serviço ("As-Is"): O Launcher é fornecido "no estado em que se encontra",
   sem garantias de qualquer natureza. Não garantimos disponibilidade contínua dos serviços.

3. Propriedade Intelectual: O Launcher facilita o download de mods. O usuário compromete-se
   a respeitar as licenças dos criadores originais (Minecraft/Mojang AB).

4. Privacidade e Contas: O uso de contas Microsoft/Xbox é feito exclusivamente através
   de autenticação oficial segura. O MLUltimate não intercepta nem armazena senhas.

5. Atualizações: O instalador efetua o download do pacote mais recente diretamente do
   repositório oficial no GitHub.

6. Limitação de Responsabilidade: Os desenvolvedores não serão responsáveis por perdas
   de dados, banimentos ou danos decorrentes do uso inadequado deste software.
EOF
}

ask_yes_no() {
  local prompt="$1"
  local default_answer="\${2:-s}"
  local answer=""
  local suffix="[s/N]"
  if [[ "$default_answer" == "s" ]]; then
    suffix="[S/n]"
  fi

  if [[ ! -t 0 ]]; then
    [[ "$default_answer" == "s" ]]
    return
  fi

  while true; do
    read -r -p "$prompt $suffix " answer
    answer="\${answer:-$default_answer}"
    case "$answer" in
      s|S|sim|SIM|y|Y|yes|YES) return 0 ;;
      n|N|nao|NAO|não|NÃO|no|NO) return 1 ;;
      *) warn "Responda com s ou n." ;;
    esac
  done
}

fetch() {
  local url="$1"
  if have curl; then
    curl -fsSL -H "User-Agent: MLUltimate-Linux-Installer" "$url"
  elif have wget; then
    wget -qO- --user-agent="MLUltimate-Linux-Installer" "$url"
  else
    die "curl ou wget é necessário para baixar o launcher."
  fi
}

download_file() {
  local url="$1"
  local destination="$2"
  if have curl; then
    curl -fL --progress-bar -H "User-Agent: MLUltimate-Linux-Installer" -o "$destination" "$url"
  elif have wget; then
    wget --show-progress --user-agent="MLUltimate-Linux-Installer" -O "$destination" "$url"
  else
    die "curl ou wget é necessário para baixar o launcher."
  fi
}

resolve_releases_python() {
  python3 -c '
import sys, json

try:
    data = json.load(sys.stdin)
    if isinstance(data, dict) and "message" in data:
        sys.exit(1)
    if not isinstance(data, list):
        data = [data]
    for rel in data:
        if rel.get("draft"):
            continue
        tag = rel.get("tag_name", "")
        assets = rel.get("assets", [])
        appimage_url = ""
        deb_url = ""
        for a in assets:
            name = a.get("name", "")
            if name.endswith(".AppImage"):
                appimage_url = a.get("browser_download_url", "")
            elif name.endswith(".deb"):
                deb_url = a.get("browser_download_url", "")
        if appimage_url or deb_url:
            print(f"{tag}\\t{appimage_url}\\t{deb_url}")
            sys.exit(0)
    sys.exit(1)
except Exception:
    sys.exit(1)
'
}

resolve_releases_jq() {
  jq -r '.[] | select(.draft != true) | [.tag_name, ([.assets[] | select(.name | endswith(".AppImage")) | .browser_download_url][0] // ""), ([.assets[] | select(.name | endswith(".deb")) | .browser_download_url][0] // "")] | @tsv' | head -n 1
}

resolve_releases_node() {
  node -e '
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  try {
    const releases = JSON.parse(input);
    const list = Array.isArray(releases) ? releases : [releases];
    for (const rel of list) {
      if (rel.draft) continue;
      const assets = rel.assets || [];
      const appimage = assets.find(a => a.name.endsWith(".AppImage"))?.browser_download_url || "";
      const deb = assets.find(a => a.name.endsWith(".deb"))?.browser_download_url || "";
      if (appimage || deb) {
        console.log([rel.tag_name, appimage, deb].join("\\t"));
        process.exit(0);
      }
    }
  } catch (e) {}
  process.exit(1);
});
'
}

resolve_releases_manifest() {
  local manifest_url="https://github.com/$repo/releases/latest/download/latest-linux.yml"
  local content
  content="$(fetch "$manifest_url" 2>/dev/null || true)"
  if [[ -n "$content" ]]; then
    local version appimage_name tag
    version="$(echo "$content" | grep -m 1 '^version:' | awk '{print $2}' | tr -d '\\r" ')"
    appimage_name="$(echo "$content" | grep -m 1 'url:.*\\.AppImage' | awk '{print $2}' | tr -d '\\r" ')"
    if [[ -z "$appimage_name" ]]; then
      appimage_name="$(echo "$content" | grep -m 1 'path:.*\\.AppImage' | awk '{print $2}' | tr -d '\\r" ')"
    fi
    if [[ -n "$version" && -n "$appimage_name" ]]; then
      tag="v$version"
      local appimage_url="$download_base/$tag/$appimage_name"
      local deb_url="$download_base/$tag/MLUltimate-Launcher-$version-linux-x64.deb"
      printf '%s\\t%s\\t%s\\n' "$tag" "$appimage_url" "$deb_url"
      return 0
    fi
  fi
  return 1
}

resolve_releases_grep() {
  local json="$1"
  local tag appimage deb
  tag="$(echo "$json" | grep -m 1 -o '"tag_name": *"[^"]*"' | sed 's/"tag_name": *"//; s/"//')"
  appimage="$(echo "$json" | grep -m 1 -o '"browser_download_url": *"[^"]*\\.AppImage"' | sed 's/"browser_download_url": *"//; s/"//')"
  deb="$(echo "$json" | grep -m 1 -o '"browser_download_url": *"[^"]*\\.deb"' | sed 's/"browser_download_url": *"//; s/"//')"
  if [[ -n "$tag" && ( -n "$appimage" || -n "$deb" ) ]]; then
    printf '%s\\t%s\\t%s\\n' "$tag" "$appimage" "$deb"
    return 0
  fi
  return 1
}

detect_distro() {
  distro_name="Linux"
  is_debian_like=false
  if [[ -f /etc/os-release ]]; then
    distro_name="$(grep -E '^PRETTY_NAME=' /etc/os-release | cut -d= -f2 | tr -d '"' || true)"
    if [[ -z "$distro_name" ]]; then
      distro_name="$(grep -E '^NAME=' /etc/os-release | cut -d= -f2 | tr -d '"' || true)"
    fi
    local distro_id
    distro_id="$(grep -E '^ID=' /etc/os-release | cut -d= -f2 | tr -d '"' | tr '[:upper:]' '[:lower:]' || true)"
    local distro_like
    distro_like="$(grep -E '^ID_LIKE=' /etc/os-release | cut -d= -f2 | tr -d '"' | tr '[:upper:]' '[:lower:]' || true)"

    if [[ "$distro_id" =~ ^(pop|ubuntu|debian|linuxmint|elementary|zorin)$ ]] || [[ "$distro_like" =~ (debian|ubuntu) ]]; then
      is_debian_like=true
    fi
  fi
  if have dpkg && have apt-get; then
    is_debian_like=true
  fi
}

header
detect_distro
info "Sistema detectado: \${bold}$distro_name\${reset}"

step "Termos de uso"
terms_text
printf '\\n'
if ! ask_yes_no "Você aceita os termos para continuar?" "n"; then
  die "Você precisa aceitar os termos para instalar o MLUltimate Launcher."
fi
ok "Termos aceitos"

step "Verificando ferramentas do sistema"
if ! have curl && ! have wget; then
  die "Instale curl ou wget e tente novamente (ex: sudo apt install curl)."
fi
ok "Ferramenta de download disponível"

target=""
step "Consultando a release oficial mais recente no GitHub"
raw_json="$(fetch "$api" 2>/dev/null || true)"

if [[ -n "$raw_json" ]]; then
  if have python3; then
    target="$(printf '%s' "$raw_json" | resolve_releases_python 2>/dev/null || true)"
  fi
  if [[ -z "$target" ]] && have jq; then
    target="$(printf '%s' "$raw_json" | resolve_releases_jq 2>/dev/null || true)"
  fi
  if [[ -z "$target" ]] && have node; then
    target="$(printf '%s' "$raw_json" | resolve_releases_node 2>/dev/null || true)"
  fi
  if [[ -z "$target" ]]; then
    target="$(resolve_releases_grep "$raw_json" 2>/dev/null || true)"
  fi
fi

if [[ -z "$target" ]]; then
  target="$(resolve_releases_manifest 2>/dev/null || true)"
fi

if [[ -z "$target" ]]; then
  die "Não foi possível encontrar uma release válida do MLUltimate Launcher no GitHub."
fi

tag="$(echo "$target" | cut -f1)"
appimage_url="$(echo "$target" | cut -f2)"
deb_url="$(echo "$target" | cut -f3)"

ok "Release encontrada: \${bold}$tag\${reset}"

install_mode="appimage"

if [[ "$is_debian_like" == "true" && -n "$deb_url" ]]; then
  step "Escolha o formato de instalação para $distro_name"
  printf '%s\\n' "  1) Pacote nativo (.deb) [Recomendado para Pop!_OS / Ubuntu / Debian - Requer sudo]"
  printf '%s\\n' "  2) Executável portátil (.AppImage) [Instala apenas no seu usuário - Sem necessidade de sudo]"

  if [[ -t 0 ]]; then
    read -r -p "Escolha a opção (1 ou 2) [Padrão: 1]: " chosen_opt
    chosen_opt="\${chosen_opt:-1}"
    if [[ "$chosen_opt" == "1" ]]; then
      install_mode="deb"
    else
      install_mode="appimage"
    fi
  else
    install_mode="deb"
  fi
fi

if [[ "$install_mode" == "deb" ]]; then
  step "Instalando pacote .deb nativo"
  tmp_deb="$(mktemp "\${TMPDIR:-/tmp}/mlultimate-$tag-XXXXXX.deb")"
  trap 'rm -f "$tmp_deb"' EXIT

  info "Baixando pacote DEB..."
  download_file "$deb_url" "$tmp_deb"

  info "Instalando via gerenciador de pacotes do sistema (solicitará sua senha se necessário)..."
  if have sudo; then
    sudo apt-get install -y "$tmp_deb" || {
      sudo dpkg -i "$tmp_deb" || sudo apt-get install -f -y
    }
  else
    apt-get install -y "$tmp_deb" || {
      dpkg -i "$tmp_deb" || apt-get install -f -y
    }
  fi

  if ask_yes_no "Deseja criar um atalho na área de trabalho?" "s"; then
    mkdir -p "$desktop_shortcut_dir"
    sys_desktop="/usr/share/applications/mlultimate-launcher.desktop"
    if [[ -f "$sys_desktop" ]]; then
      cp "$sys_desktop" "$desktop_shortcut_file"
      chmod +x "$desktop_shortcut_file"
      if have gio; then
        gio set "$desktop_shortcut_file" metadata::trusted true 2>/dev/null || true
      fi
      ok "Atalho criado em: $desktop_shortcut_file"
    fi
  fi

  ok "MLUltimate Launcher instalado com sucesso no sistema!"
  info "Você já pode encontrá-lo no menu de aplicativos do Pop!_OS."

  if ask_yes_no "Deseja abrir o MLUltimate agora?" "s"; then
    nohup mlultimate-launcher >/dev/null 2>&1 &
  fi

else
  step "Instalação do AppImage no seu usuário"
  mkdir -p "$install_dir" "$bin_dir" "$desktop_dir"

  tmp_appimage="$(mktemp "\${TMPDIR:-/tmp}/mlultimate-$tag-XXXXXX.AppImage")"
  trap 'rm -f "$tmp_appimage"' EXIT

  info "Baixando executável AppImage..."
  download_file "$appimage_url" "$tmp_appimage"

  mv "$tmp_appimage" "$appimage_path"
  chmod +x "$appimage_path"
  ok "Executável instalado em: $appimage_path"

  info "Configurando ícone do launcher..."
  if fetch "$icon_url" > "$icon_path.tmp" 2>/dev/null; then
    mv "$icon_path.tmp" "$icon_path"
  else
    rm -f "$icon_path.tmp"
    warn "Não foi possível baixar o ícone do menu, mas o launcher foi instalado."
  fi

  # Cria o script wrapper com suporte automático a FUSE (essencial para Pop!_OS 22.04+ e 24.04+)
  cat > "$wrapper_path" <<EOF
#!/usr/bin/env bash
# Detecção automática de libfuse2 ausente (comum no Pop!_OS 22.04+/24.04+ e Ubuntu 24.04+)
if ! ldconfig -p 2>/dev/null | grep -qE "libfuse\\\\.so\\\\.2|libfuse2" && [ ! -f /lib/x86_64-linux-gnu/libfuse.so.2 ] && [ ! -f /usr/lib/x86_64-linux-gnu/libfuse.so.2 ] && [ ! -f /usr/lib/libfuse.so.2 ] && [ ! -f /lib64/libfuse.so.2 ]; then
  export APPIMAGE_EXTRACT_AND_RUN=1
fi
exec "$appimage_path" "\\$@"
EOF
  chmod +x "$wrapper_path"
  ok "Comando criado em: $wrapper_path"

  # Cria o atalho no menu de aplicativos (.desktop)
  cat > "$desktop_file" <<EOF
[Desktop Entry]
Type=Application
Name=MLUltimate Launcher
Comment=Launcher desktop para instalar, organizar e jogar Minecraft e modpacks.
Exec=$wrapper_path %U
Icon=$icon_path
Terminal=false
Categories=Game;ActionGame;AdventureGame;
StartupWMClass=mlultimate-launcher
StartupNotify=true
Keywords=minecraft;launcher;mlultimate;modpack;
EOF
  chmod +x "$desktop_file"
  ok "Atalho registrado no menu de aplicativos"

  if ask_yes_no "Deseja criar um atalho na área de trabalho?" "s"; then
    mkdir -p "$desktop_shortcut_dir"
    cp "$desktop_file" "$desktop_shortcut_file"
    chmod +x "$desktop_shortcut_file"
    if have gio; then
      gio set "$desktop_shortcut_file" metadata::trusted true 2>/dev/null || true
    fi
    ok "Atalho criado em: $desktop_shortcut_file"
  else
    rm -f "$desktop_shortcut_file"
  fi

  if have update-desktop-database; then
    update-desktop-database "$desktop_dir" >/dev/null 2>&1 || true
  fi

  if [[ ":\$PATH:" != *":$bin_dir:"* ]]; then
    info "Dica: Adicione $bin_dir ao seu PATH para executar 'mlultimate-launcher' em qualquer terminal."
  fi

  ok "MLUltimate Launcher instalado com sucesso!"

  if ask_yes_no "Deseja abrir o MLUltimate agora?" "s"; then
    nohup "$wrapper_path" >/dev/null 2>&1 &
  fi
fi
`,
);
chmodSync(linuxOutputPath, 0o755);
console.log(`Linux online installer created: ${linuxOutputPath}`);
}

writeFileSync(
  downloadPagePath,
  `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Baixar MLUltimate Launcher</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0e1117;
        --panel: #171d26;
        --panel-strong: #202837;
        --text: #f8fafc;
        --muted: #b8c1d1;
        --line: rgba(255, 255, 255, 0.14);
        --green: #22c55e;
        --green-dark: #15803d;
        --blue: #38bdf8;
        --amber: #f59e0b;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: var(--bg);
        color: var(--text);
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", sans-serif;
      }

      .shell {
        min-height: 100vh;
        background:
          linear-gradient(90deg, rgba(14, 17, 23, 0.98), rgba(14, 17, 23, 0.74)),
          url("./mlultimate-download-hero.png") center / cover;
        display: flex;
        align-items: center;
        padding: 40px 20px;
      }

      .content {
        width: min(100%, 1080px);
        margin: 0 auto;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 390px;
        gap: 36px;
        align-items: center;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 32px;
      }

      .brand img {
        width: 58px;
        height: 58px;
        border-radius: 14px;
      }

      .brand-name {
        font-size: 17px;
        font-weight: 800;
      }

      h1 {
        margin: 0;
        max-width: 760px;
        font-size: clamp(36px, 6vw, 70px);
        line-height: 0.96;
        letter-spacing: 0;
      }

      .lead {
        max-width: 640px;
        margin: 24px 0 0;
        color: var(--muted);
        font-size: 17px;
        line-height: 1.6;
      }

      .trust {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 28px;
      }

      .trust span {
        border: 1px solid var(--line);
        background: rgba(14, 17, 23, 0.62);
        border-radius: 999px;
        padding: 9px 12px;
        color: #dbeafe;
        font-size: 13px;
        font-weight: 700;
      }

      .panel {
        border: 1px solid var(--line);
        background: rgba(23, 29, 38, 0.94);
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.35);
      }

      .panel h2 {
        margin: 0 0 16px;
        font-size: 20px;
      }

      .download {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        min-height: 74px;
        border: 1px solid var(--line);
        background: var(--panel-strong);
        border-radius: 8px;
        padding: 14px;
        color: inherit;
        text-decoration: none;
        transition:
          transform 160ms ease,
          border-color 160ms ease,
          background 160ms ease;
      }

      .download + .download {
        margin-top: 12px;
      }

      .download:hover {
        transform: translateY(-1px);
        border-color: rgba(56, 189, 248, 0.66);
        background: #263247;
      }

      .download strong {
        display: block;
        margin-bottom: 4px;
        font-size: 15px;
      }

      .download small {
        display: block;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.35;
      }

      .button {
        flex: 0 0 auto;
        min-width: 88px;
        border-radius: 8px;
        background: var(--green);
        color: #04130a;
        padding: 11px 13px;
        font-size: 13px;
        font-weight: 900;
        text-align: center;
      }

      .download:hover .button {
        background: #4ade80;
      }

      .note {
        margin: 16px 0 0;
        border-left: 3px solid var(--blue);
        padding-left: 12px;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.5;
      }

      .code-box {
        margin-top: 6px;
        background: #0d1117;
        border: 1px solid var(--line);
        border-radius: 6px;
        padding: 8px 10px;
        font-family: ui-monospace, monospace;
        font-size: 11px;
        color: #7dd3fc;
        word-break: break-all;
        user-select: all;
      }

      .direct {
        margin-top: 18px;
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }

      .direct a {
        color: var(--blue);
        font-size: 13px;
        font-weight: 700;
      }

      @media (max-width: 860px) {
        .shell {
          align-items: flex-start;
          padding: 26px 16px;
        }

        .content {
          grid-template-columns: 1fr;
          gap: 28px;
        }

        .brand {
          margin-bottom: 24px;
        }

        .panel {
          padding: 16px;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="content" aria-label="Download do MLUltimate Launcher">
        <div>
          <div class="brand">
            <img src="./mlultimate-download-logo.png" alt="MLUltimate" />
            <div>
              <div class="brand-name">MLUltimate Launcher</div>
              <div>Instalador oficial</div>
            </div>
          </div>

          <h1>Baixe o launcher oficial.</h1>
          <p class="lead">
            Instaladores com busca automática da versão mais recente publicada no GitHub.
            Compatível com Windows 10/11 e distribuições Linux (Pop!_OS, Ubuntu, Debian, Fedora e Arch).
          </p>

          <div class="trust" aria-label="Garantias">
            <span>Criador: MLUltimate Team</span>
            <span>Fornecedor: MLUltimate</span>
            <span>Release oficial do GitHub</span>
            <span>100% Livre de malware & seguro</span>
          </div>
        </div>

        <aside class="panel" aria-label="Escolha seu sistema">
          <h2>Escolha seu sistema</h2>

          <a class="download" href="./MLUltimate-Installer-Windows.exe" download>
            <span>
              <strong>Windows (.exe)</strong>
              <small>Instalador oficial seguro para Windows (Criador: MLUltimate Team).</small>
            </span>
            <span class="button">Baixar</span>
          </a>

          <a class="download" href="./MLUltimate-Installer-Linux.sh" download>
            <span>
              <strong>Linux (.sh)</strong>
              <small>Instalador automático (Pop!_OS, Ubuntu, Debian, etc.).</small>
            </span>
            <span class="button">Baixar</span>
          </a>

          <div class="note" style="border-left-color: #38bdf8;">
            <strong style="color: #7dd3fc; display: block; margin-bottom: 2px;">Aviso do Windows Defender / SmartScreen:</strong>
            <span>Como este é um executável de lançamento recente sem certificado pago caro, o Windows pode exibir uma tela azul informativa. Basta clicar em <strong>"Mais informações"</strong> e depois em <strong>"Executar assim mesmo"</strong>. O aplicativo é 100% seguro e de código aberto.</span>
          </div>

          <div class="note">
            <span>No Linux, execute no terminal:</span>
            <div class="code-box">chmod +x MLUltimate-Installer-Linux.sh && ./MLUltimate-Installer-Linux.sh</div>
          </div>

          <div class="direct">
            <a href="https://github.com/GuelBDev/MLUltimate/releases" rel="noreferrer">
              Ver releases (.deb / .AppImage)
            </a>
          </div>
        </aside>
      </section>
    </main>
  </body>
</html>
`,
);
console.log(`Download page created: ${downloadPagePath}`);

if (!buildWin) {
  process.exit(0);
}

if (process.platform !== "win32") {
  console.log("Online installer packaging skipped outside Windows.");
  process.exit(0);
}

const csc = findCsc();

if (!csc) {
  throw new Error("csc.exe was not found. Cannot build Windows online installer.");
}

execFileSync(
  csc,
  [
    "/nologo",
    "/target:winexe",
    `/out:${outputPath}`,
    `/win32icon:${path.join(root, "build", "icon.ico")}`,
    `/win32manifest:${manifestPath}`,
    "/reference:System.dll",
    "/reference:System.Drawing.dll",
    "/reference:System.Windows.Forms.dll",
    `/resource:${heroPath},launcher-hero.png`,
    `/resource:${iconPath},mlultimate-icon.png`,
    csharpPath,
  ],
  { stdio: "inherit" },
);

if (!existsSync(outputPath)) {
  throw new Error(`Online installer was not created at ${outputPath}`);
}

console.log(`Online installer created: ${outputPath}`);

copyFileSync(outputPath, windowsSiteOutputPath);
console.log(`Windows site installer created: ${windowsSiteOutputPath}`);

function findCsc() {
  const systemRoot = process.env.SystemRoot ?? "C:\\Windows";
  const candidates = [
    path.join(systemRoot, "Microsoft.NET", "Framework64", "v4.0.30319", "csc.exe"),
    path.join(systemRoot, "Microsoft.NET", "Framework", "v4.0.30319", "csc.exe"),
  ];

  return candidates.find((candidate) => existsSync(candidate));
}

function toAssemblyVersion(version) {
  const parts = String(version)
    .split(/[^0-9]+/)
    .filter(Boolean)
    .slice(0, 4);

  while (parts.length < 4) {
    parts.push("0");
  }

  return parts.join(".");
}

